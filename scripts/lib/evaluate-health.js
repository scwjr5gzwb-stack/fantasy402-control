/**
 * @param {Record<string, unknown>} metrics from loadControlMetrics
 * @param {{ coverageMin?: number }} [opts]
 */
export function evaluateHealth(metrics, opts = {}) {
  const coverageMin =
    opts.coverageMin ??
    Number(process.env.FANTASY402_COVERAGE_ALERT_MIN ?? "0.8");
  const threshold = Number.isFinite(coverageMin) ? coverageMin : 0.8;

  const h = /** @type {Record<string, unknown>} */ (metrics.health ?? {});
  /** @type {Array<{ code: string, message: string, severity: string }>} */
  const alerts = [];

  if (h.overall === "red") {
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
  const htmlCaptured = pending.htmlSnapshotCaptured === true;
  const boundRots = pending.boundRots;
  if (
    htmlCaptured &&
    (boundRots == null || (typeof boundRots === "number" && boundRots === 0))
  ) {
    alerts.push({
      code: "pending_parse_empty",
      message:
        "Pending HTML snapshot captured but pending-rot-leg-trace has no parsed legs",
      severity: "warning",
    });
  } else if (
    pending.replayBasis === "pending" &&
    pending.available !== true &&
    htmlCaptured
  ) {
    alerts.push({
      code: "pending_metrics_missing",
      message: "Pending replay manifest but pending metrics unavailable",
      severity: "warning",
    });
  }

  const ok = alerts.length === 0 && h.overall === "green";
  return {
    ok,
    alerts,
    snapshot: {
      overall: h.overall ?? null,
      gradedRotCoveragePct: pct ?? h.gradedRotCoveragePct ?? null,
      gateFailures: gateFailures ?? null,
      threshold,
      pendingBoundRots: boundRots ?? null,
      evaluatedAt: new Date().toISOString(),
    },
  };
}
