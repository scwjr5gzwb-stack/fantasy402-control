import { describe, expect, test } from "bun:test";
import { loadControlMetrics } from "../scripts/lib/load-metrics.js";

describe("loadControlMetrics health overall", () => {
  test("pending snapshot skip yields amber overall and null boundRots", async () => {
    const m = await loadControlMetrics();
    if (m.replayCohort !== "pending" || !m.pending?.htmlSnapshotSkipped) {
      return;
    }
    expect(m.health.overall).toBe("amber");
    expect(m.pending.boundRots).toBe(null);
    expect(m.pending.pendingTraceStale).toBe(true);
  });
});
