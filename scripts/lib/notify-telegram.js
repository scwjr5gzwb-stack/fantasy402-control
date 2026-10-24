import { join } from "path";
import { autopilotArtifactsDir } from "./autopilot-state.js";

/** @param {string} [controlRoot] */
function stateFilePath(controlRoot) {
  return join(autopilotArtifactsDir(controlRoot), ".last-alert-state.json");
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {Array<{ message: string, severity: string }>} alerts
 * @param {Record<string, unknown>} metrics
 * @param {{ dryRun?: boolean, controlRoot?: string }} [options]
 */
export async function notifyAutopilotAlerts(alerts, metrics, options = {}) {
  if (!alerts?.length) return;

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  const h = /** @type {Record<string, unknown>} */ (metrics.health ?? {});
  const gateFailures = Number(h.gateFailures ?? 0);
  const isCritical =
    h.overall === "red" ||
    gateFailures > 0 ||
    alerts.some((a) => a.severity === "critical");
  const severity = isCritical ? "RED" : "AMBER";

  const statePath = stateFilePath(options.controlRoot);
  /** @type {{ severity: string, timestamp: number }} */
  let lastState = { severity: "green", timestamp: 0 };
  try {
    if (await Bun.file(statePath).exists()) {
      lastState = await Bun.file(statePath).json();
    }
  } catch {
    /* first run */
  }

  const now = Date.now();
  const isNewState = lastState.severity !== severity;
  const isSpamWindowOver =
    isCritical && now - (lastState.timestamp ?? 0) > 60 * 60 * 1000;

  if (!isNewState && !isSpamWindowOver) {
    console.log(
      `[telegram] suppress duplicate ${severity} (last ${new Date(lastState.timestamp).toISOString()})`,
    );
    return;
  }

  const emoji = isCritical ? "🚨" : "⚠️";
  const title = isCritical
    ? "<b>FANTASY402 CRITICAL ALERT</b>"
    : "<b>Fantasy402 Warning</b>";

  const alertList = alerts.map((a) => `• ${escapeHtml(a.message)}`).join("\n");

  const pctRaw = h.gradedRotCoveragePct;
  const pctStr =
    typeof pctRaw === "number" && Number.isFinite(pctRaw)
      ? `${(pctRaw * 100).toFixed(1)}%`
      : "—";

  const metricsBlock = [
    `<b>Coverage:</b> ${escapeHtml(pctStr)}`,
    `<b>Gate failures:</b> ${escapeHtml(String(gateFailures))}`,
    `<b>Overall:</b> ${escapeHtml(String(h.overall ?? "—"))}`,
  ].join("\n");

  const messageText = `${emoji} ${title}\n\n${alertList}\n\n${metricsBlock}`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: messageText,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (options.dryRun) {
    console.log("[telegram] dry-run would send:");
    console.log(messageText);
    return;
  }

  if (!botToken || !chatId) {
    console.warn(
      "[telegram] alert triggered but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing",
    );
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.description ?? res.statusText);
    }
    console.log(`[telegram] sent (${severity})`);
    await Bun.write(
      statePath,
      JSON.stringify({ severity, timestamp: now }, null, 2),
    );
  } catch (err) {
    console.error(
      "[telegram] send failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** @param {string} [controlRoot] */
export async function resetAlertState(controlRoot) {
  const statePath = stateFilePath(controlRoot);
  await Bun.write(
    statePath,
    JSON.stringify({ severity: "green", timestamp: Date.now() }, null, 2),
  );
}
