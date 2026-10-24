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
    expect(m.pendingTracePresent).toBe(false);
  });

  test("pending trace alone marks available with bound rots", () => {
    const m = buildPendingMetrics(null, null, {
      legTraceCount: 144,
      gateFailureCount: 0,
    });
    expect(m.available).toBe(true);
    expect(m.boundRots).toBe(144);
  });

  test("skipped snapshot on pending replay ignores stale trace rots", () => {
    const m = buildPendingMetrics(
      {
        graphCohort: { basis: "pending" },
        pendingHtmlSnapshot: { skipped: true, reason: "no rows" },
      },
      { rows: 31459, edges: 512973 },
      { legTraceCount: 144, gateFailureCount: 0 },
    );
    expect(m.legs).toBe(31459);
    expect(m.boundRots).toBe(null);
    expect(m.pendingTraceStale).toBe(true);
  });
});
