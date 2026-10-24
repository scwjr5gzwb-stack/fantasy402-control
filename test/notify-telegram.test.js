import { describe, expect, test } from "bun:test";
import { notifyAutopilotAlerts } from "../scripts/lib/notify-telegram.js";

describe("notify-telegram", () => {
  test("dry-run formats HTML without credentials", async () => {
    const logs = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(" "));
    try {
      await notifyAutopilotAlerts(
        [{ message: "gateFailureCount=1", severity: "critical" }],
        {
          health: {
            overall: "amber",
            gateFailures: 1,
            gradedRotCoveragePct: 0.75,
          },
        },
        { dryRun: true },
      );
    } finally {
      console.log = orig;
    }
    const blob = logs.join("\n");
    expect(blob).toContain("dry-run");
    expect(blob).toContain("CRITICAL");
    expect(blob).toContain("75.0%");
  });
});
