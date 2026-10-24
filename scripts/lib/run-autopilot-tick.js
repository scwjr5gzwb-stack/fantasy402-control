import { loadControlMetrics } from "./load-metrics.js";
import { tryHealPendingParseFromSnapshot } from "./autopilot-heal.js";
import { notifyDashboardReload } from "./notify-dashboard-reload.js";
import {
  appendAutopilotAlert,
  writeAutopilotState,
} from "./autopilot-state.js";
import { notifyAutopilotAlerts, resetAlertState } from "./notify-telegram.js";

/**
 * @param {string} [controlRoot]
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function runAutopilotTick(controlRoot, options = {}) {
  let metrics = await loadControlMetrics();
  const heal = await tryHealPendingParseFromSnapshot(metrics.skillsRoot);
  if (heal.healed) {
    metrics = await loadControlMetrics();
    const reload = await notifyDashboardReload();
    if (reload.ok) {
      console.log("[autopilot] dashboard reload signal sent");
    }
  } else if (heal.error) {
    console.warn("[autopilot] heal failed:", heal.error);
  }
  const alerts = /** @type {Array<Record<string, unknown>>} */ (
    metrics.health.activeAlerts ?? []
  );
  const row = {
    at: new Date().toISOString(),
    ok: metrics.health.ok === true,
    alerts,
    snapshot: metrics.health.snapshot ?? {
      overall: metrics.health.overall,
    },
    skillsRoot: metrics.skillsRoot,
  };

  await writeAutopilotState(
    { lastTick: row, metricsLoadedAt: metrics.loadedAt },
    controlRoot,
  );

  for (const alert of alerts) {
    await appendAutopilotAlert({ ...row, alert }, controlRoot);
    console.error(
      `[autopilot] ${alert.severity} ${alert.code}: ${alert.message}`,
    );
    if (typeof alert.remediation === "string") {
      console.error(`[autopilot]   fix: ${alert.remediation}`);
    }
  }

  if (alerts.length > 0) {
    await notifyAutopilotAlerts(alerts, metrics, {
      dryRun: options.dryRun,
      controlRoot,
    });
  } else if (row.ok) {
    await resetAlertState(controlRoot);
    console.log("[autopilot] green", row.snapshot);
  } else if (alerts.length === 0) {
    console.log("[autopilot] amber", row.snapshot);
  }

  return row;
}
