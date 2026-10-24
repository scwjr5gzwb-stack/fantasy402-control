/** @typedef {{ code: string, message: string, severity: string, remediation?: string }} HealthAlert */

/** @param {string} code @param {string} [skillsRoot] */
export function remediationForAlert(code, skillsRoot) {
  const root = skillsRoot?.trim() || "~/fantasy402-skills";
  const cd = `cd ${root}`;
  switch (code) {
    case "artifacts_missing":
      return `${cd} && bun --env-file=.env.local rots run && FANTASY402_GRAPH_COHORT=graded bun run graph:replay`;
    case "graded_gate_fail":
      return `${cd} && bun rots gate --dry-run && bun rots sample-none --limit=5`;
    case "coverage_below_min":
      return `${cd} && bun rots sample-none --market=GAME --limit=10`;
    case "pending_parse_failed":
    case "pending_parse_empty":
      return `${cd} && bun rots parse-pending --write-trace`;
    case "pending_snapshot_missing":
      return `${cd} && bun run graph:replay  # or raise FANTASY402_PENDING_HTML_MAX_WAIT_MS`;
    case "pending_metrics_missing":
      return `${cd} && bun run graph:replay && bun rots parse-pending --write-trace`;
    default:
      return undefined;
  }
}

/** @param {HealthAlert[]} alerts @param {string} [skillsRoot] */
export function withRemediations(alerts, skillsRoot) {
  return alerts.map((a) => {
    const remediation = remediationForAlert(a.code, skillsRoot);
    return remediation ? { ...a, remediation } : a;
  });
}
