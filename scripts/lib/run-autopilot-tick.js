import { loadControlMetrics } from "./load-metrics.js";
import { evaluateHealth } from "./evaluate-health.js";
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
  const metrics = await loadControlMetrics();
  const evaluation = evaluateHealth(metrics);
  const row = {
    at: new Date().toISOString(),
    ok: evaluation.ok,
    alerts: evaluation.alerts,
    snapshot: evaluation.snapshot,
    skillsRoot: metrics.skillsRoot,
  };

  await writeAutopilotState(
    { lastTick: row, metricsLoadedAt: metrics.loadedAt },
    controlRoot,
  );

  for (const alert of evaluation.alerts) {
    await appendAutopilotAlert({ ...row, alert }, controlRoot);
    console.error(
      `[autopilot] ${alert.severity} ${alert.code}: ${alert.message}`,
    );
  }

  if (evaluation.alerts.length > 0) {
    await notifyAutopilotAlerts(evaluation.alerts, metrics, {
      dryRun: options.dryRun,
      controlRoot,
    });
  } else if (evaluation.ok) {
    await resetAlertState(controlRoot);
    console.log("[autopilot] green", evaluation.snapshot);
  } else if (evaluation.alerts.length === 0) {
    console.log("[autopilot] amber", evaluation.snapshot);
  }

  return row;
}
