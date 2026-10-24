import { describe, expect, test } from "bun:test";
import {
  broadcastDashboardReload,
  createSseResponse,
} from "../scripts/lib/dashboard-sse-hub.js";

describe("dashboard API helpers", () => {
  test("trigger-reload broadcast path used by POST handler", () => {
    const res = createSseResponse();
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(broadcastDashboardReload()).toBe(1);
    res.body?.cancel();
  });
});
