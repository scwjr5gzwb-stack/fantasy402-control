import { withRemediations } from "./health-remediations.js";

/**
 * @param {Record<string, unknown>} metrics from loadControlMetrics
 * @param {{ coverageMin?: number }} [opts]
 */
export function evaluateHealth(metrics, opts = {}) {
  const skillsRootPath =
    opts.skillsRoot ??
    (typeof metrics.skillsRoot === "string" ? metrics.skillsRoot : undefined);
  const coverageMin =
    opts.coverageMin ??
    Number(process.env.FANTASY402_COVERAGE_ALERT_MIN ?? "0.8");
  const threshold = Number.isFinite(coverageMin) ? coverageMin : 0.8;

  const h = /** @type {Record<string, unknown>} */ (metrics.health ?? {});
  /** @type {Array<{ code: string, message: string, severity: string }>} */
  const alerts = [];

  const manifestPresent = h.manifestPresent === true;
  const tracePresent = h.tracePresent === true;
  const gatesPass = h.allGatesPass === true;

  /** @type {"green" | "amber" | "red"} */
  let overall = "red";
  if (manifestPresent && tracePresent && gatesPass) overall = "green";
  else if (manifestPresent || tracePresent) overall = "amber";

  if (!manifestPresent && !tracePresent) {
    alerts.push({
      code: "artifacts_missing",
      message: "Manifest or trace artifacts missing under skills root",
      severity: "critical",
    });
  }

  const gateFailures = h.gateFailures;
  if (typeof gateFailures === "number" && gateFailures > 0) {
    alerts.push({
      code: "graded_gate_fail",
      message: `gateFailureCount=${gateFailures}`,
      severity: "critical",
    });
  } else if (h.allGatesPass === false) {
    alerts.push({
      code: "graded_gate_fail",
      message: "Rot parser gates did not pass",
      severity: "critical",
    });
  }

  const manifest = /** @type {Record<string, unknown>} */ (
    metrics.manifest ?? {}
  );
  const gc = /** @type {Record<string, unknown>} */ (
    manifest.graphCohort ?? {}
  );
  const cj = /** @type {Record<string, unknown>} */ (gc.cohortJoin ?? {});
  const pct = cj.gradedRotCoveragePct;
  if (typeof pct === "number" && pct < threshold) {
    alerts.push({
      code: "coverage_below_min",
      message: `gradedRotCoveragePct=${pct} below ${threshold}`,
      severity: "warning",
    });
  }

  const pending = /** @type {Record<string, unknown>} */ (
    metrics.pending ?? {}
  );
  const basisPending = pending.replayBasis === "pending";
  const htmlCaptured = pending.htmlSnapshotCaptured === true;
  const htmlSkipped = pending.htmlSnapshotSkipped === true;
  const pendingTraceOnDisk = pending.pendingTracePresent === true;
  const boundRots = pending.boundRots;
  const skipReason =
    typeof pending.htmlSnapshotReason === "string"
      ? pending.htmlSnapshotReason
      : "unknown";

  if (basisPending && htmlCaptured && !pendingTraceOnDisk) {
    alerts.push({
      code: "pending_parse_failed",
      message:
        "Pending replay captured HTML but pending-rot-leg-trace.json is missing (run parse-pending or enable auto-parse on replay)",
      severity: "critical",
    });
  } else if (
    htmlCaptured &&
    pendingTraceOnDisk &&
    (boundRots == null || (typeof boundRots === "number" && boundRots === 0))
  ) {
    alerts.push({
      code: "pending_parse_empty",
      message:
        "Pending HTML snapshot captured but pending-rot-leg-trace has no parsed legs",
      severity: "warning",
    });
  } else if (basisPending && htmlSkipped) {
    alerts.push({
      code: "pending_snapshot_missing",
      message: `Pending HTML snapshot skipped: ${skipReason}`,
      severity: "warning",
    });
  } else if (
    basisPending &&
    pending.available !== true &&
    htmlCaptured
  ) {
    alerts.push({
      code: "pending_metrics_missing",
      message: "Pending replay manifest but pending metrics unavailable",
      severity: "warning",
    });
  }

  const replayOk = h.replayLifecycleOk;
  const replayViolation = h.replayViolation;
  const replayPhase = h.replayPhase;
  const replayReason =
    typeof h.replayReason === "string" ? h.replayReason : null;
  if (replayOk === false) {
    if (replayViolation === "task_interrupted") {
      alerts.push({
        code: "evaluate_interrupted",
        message: `Graph evaluate interrupted during ${replayPhase ?? "unknown"}${replayReason ? `: ${replayReason}` : ""}`,
        severity: "critical",
      });
    } else {
      alerts.push({
        code: "replay_incomplete",
        message: `Replay lifecycle stopped at ${replayPhase ?? "error"}${replayReason ? `: ${replayReason}` : ""}`,
        severity: replayViolation === "validation_failed" ? "critical" : "warning",
      });
    }
  } else if (replayOk == null && manifestPresent && manifest.finishedAt) {
    alerts.push({
      code: "replay_lifecycle_missing",
      message: "Manifest lacks replayLifecycle (pre-instrumentation run)",
      severity: "warning",
    });
  }

  if (alerts.some((a) => a.severity === "critical")) {
    overall = "red";
  } else if (
    alerts.some((a) => a.severity === "warning") &&
    overall === "green"
  ) {
    overall = "amber";
  }

  const ok = alerts.length === 0 && overall === "green";
  return {
    ok,
    overall,
    alerts: withRemediations(alerts, skillsRootPath),
    snapshot: {
      overall,
      gradedRotCoveragePct: pct ?? h.gradedRotCoveragePct ?? null,
      gateFailures: gateFailures ?? null,
      threshold,
      pendingBoundRots: boundRots ?? null,
      evaluatedAt: new Date().toISOString(),
    },
  };
}
