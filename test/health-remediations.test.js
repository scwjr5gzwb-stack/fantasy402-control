import { describe, expect, test } from "bun:test";
import {
  remediationForAlert,
  withRemediations,
} from "../scripts/lib/health-remediations.js";

describe("health-remediations", () => {
  test("known codes get fix hints", () => {
    expect(remediationForAlert("pending_snapshot_missing")).toContain(
      "graph:replay",
    );
    expect(remediationForAlert("pending_parse_failed")).toContain(
      "parse-pending",
    );
  });

  test("withRemediations attaches field", () => {
    const out = withRemediations([
      { code: "graded_gate_fail", message: "x", severity: "critical" },
    ]);
    expect(out[0].remediation).toContain("rots gate");
  });
});
