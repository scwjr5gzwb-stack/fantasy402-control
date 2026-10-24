/** @typedef {{ code: string, message: string, severity: string, remediation?: string }} HealthAlert */

/** @param {string} code */
export function remediationForAlert(code) {
  switch (code) {
    case "artifacts_missing":
      return "cd ~/fantasy402-skills && bun --env-file=.env.local rots run && FANTASY402_GRAPH_COHORT=graded bun run graph:replay";
    case "graded_gate_fail":
      return "cd ~/fantasy402-skills && bun rots gate --dry-run && bun rots sample-none --limit=5";
    case "coverage_below_min":
      return "cd ~/fantasy402-skills && bun rots sample-none --market=GAME --limit=10";
    case "pending_parse_failed":
    case "pending_parse_empty":
      return "cd ~/fantasy402-skills && bun rots parse-pending --write-trace";
    case "pending_snapshot_missing":
      return "cd ~/fantasy402-skills && bun run graph:replay  # or raise FANTASY402_PENDING_HTML_MAX_WAIT_MS";
    case "pending_metrics_missing":
      return "cd ~/fantasy402-skills && bun run graph:replay && bun rots parse-pending --write-trace";
    default:
      return undefined;
  }
}

/** @param {HealthAlert[]} alerts */
export function withRemediations(alerts) {
  return alerts.map((a) => {
    const remediation = remediationForAlert(a.code);
    return remediation ? { ...a, remediation } : a;
  });
}
