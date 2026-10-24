import { describe, expect, test } from "bun:test";
import { buildPendingMetrics } from "../scripts/lib/load-metrics.js";

describe("buildPendingMetrics", () => {
  test("pending replay basis uses graph summary legs", () => {
    const m = buildPendingMetrics(
      { graphCohort: { basis: "pending" }, pendingHtmlSnapshot: { path: "x" } },
      { rows: 31459, edges: 512973, tickets: 14314 },
      null,
    );
    expect(m.available).toBe(true);
    expect(m.legs).toBe(31459);
    expect(m.htmlSnapshotCaptured).toBe(true);
  });

  test("pending trace alone marks available with bound rots", () => {
    const m = buildPendingMetrics(null, null, {
      legTraceCount: 144,
      gateFailureCount: 0,
    });
    expect(m.available).toBe(true);
    expect(m.boundRots).toBe(144);
  });
});
