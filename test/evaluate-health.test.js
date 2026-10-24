import { describe, expect, test } from "bun:test";
import { evaluateHealth } from "../scripts/lib/evaluate-health.js";

describe("evaluate-health", () => {
  test("green metrics produce ok", () => {
    const r = evaluateHealth(
      {
        health: {
          overall: "green",
          allGatesPass: true,
          gateFailures: 0,
        },
        manifest: {
          graphCohort: {
            cohortJoin: { gradedRotCoveragePct: 0.886 },
          },
        },
      },
      { coverageMin: 0.8 },
    );
    expect(r.ok).toBe(true);
    expect(r.alerts.length).toBe(0);
  });

  test("gate failures alert", () => {
    const r = evaluateHealth(
      {
        health: { overall: "amber", gateFailures: 2, allGatesPass: false },
        manifest: {},
      },
      { coverageMin: 0.8 },
    );
    expect(r.ok).toBe(false);
    expect(r.alerts.some((a) => a.code === "graded_gate_fail")).toBe(true);
  });

  test("low coverage alert", () => {
    const r = evaluateHealth(
      {
        health: { overall: "green", allGatesPass: true, gateFailures: 0 },
        manifest: {
          graphCohort: {
            cohortJoin: { gradedRotCoveragePct: 0.75 },
          },
        },
      },
      { coverageMin: 0.8 },
    );
    expect(r.alerts.some((a) => a.code === "coverage_below_min")).toBe(true);
  });

  test("missing artifacts", () => {
    const r = evaluateHealth({ health: { overall: "red" }, manifest: null });
    expect(r.alerts.some((a) => a.code === "artifacts_missing")).toBe(true);
  });

  test("pending html without parse triggers warning", () => {
    const r = evaluateHealth(
      {
        health: { overall: "green", allGatesPass: true, gateFailures: 0 },
        manifest: {
          graphCohort: { cohortJoin: { gradedRotCoveragePct: 0.9 } },
        },
        pending: {
          htmlSnapshotCaptured: true,
          pendingTracePresent: true,
          boundRots: 0,
        },
      },
      { coverageMin: 0.8 },
    );
    expect(r.alerts.some((a) => a.code === "pending_parse_empty")).toBe(true);
  });

  test("pending snapshot skip on pending replay is amber", () => {
    const r = evaluateHealth(
      {
        health: { overall: "green", allGatesPass: true, gateFailures: 0 },
        manifest: {
          graphCohort: { cohortJoin: { gradedRotCoveragePct: 0.9 } },
        },
        pending: {
          replayBasis: "pending",
          htmlSnapshotSkipped: true,
          htmlSnapshotReason: "no tr[data-ticket]",
          pendingTracePresent: true,
        },
      },
      { coverageMin: 0.8 },
    );
    expect(r.alerts.some((a) => a.code === "pending_snapshot_missing")).toBe(
      true,
    );
  });

  test("missing pending trace after capture is critical", () => {
    const r = evaluateHealth(
      {
        health: { overall: "green", allGatesPass: true, gateFailures: 0 },
        manifest: {
          graphCohort: { cohortJoin: { gradedRotCoveragePct: 0.9 } },
        },
        pending: {
          replayBasis: "pending",
          htmlSnapshotCaptured: true,
          pendingTracePresent: false,
        },
      },
      { coverageMin: 0.8 },
    );
    expect(r.alerts.some((a) => a.code === "pending_parse_failed")).toBe(true);
  });

  test("graded replay html skip does not pending-alert", () => {
    const r = evaluateHealth(
      {
        health: { overall: "green", allGatesPass: true, gateFailures: 0 },
        manifest: {
          graphCohort: { cohortJoin: { gradedRotCoveragePct: 0.9 } },
        },
        pending: {
          replayBasis: "graded",
          htmlSnapshotSkipped: true,
          htmlSnapshotReason: "no tr[data-ticket]",
        },
      },
      { coverageMin: 0.8 },
    );
    expect(r.alerts.some((a) => a.code === "pending_snapshot_missing")).toBe(
      false,
    );
  });
});
