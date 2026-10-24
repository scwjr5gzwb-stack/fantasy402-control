import { describe, expect, test } from "bun:test";
import {
  autopilotTickShouldSkip,
  markAutopilotTickRan,
} from "../scripts/lib/autopilot-tick-guard.js";

describe("autopilot-tick-guard", () => {
  test("skips within 5m window", () => {
    expect(autopilotTickShouldSkip({ FANTASY402_AUTOPILOT_TICK_MIN_MS: "300000" })).toBe(
      false,
    );
    markAutopilotTickRan();
    expect(autopilotTickShouldSkip({ FANTASY402_AUTOPILOT_TICK_MIN_MS: "300000" })).toBe(
      true,
    );
  });
});
