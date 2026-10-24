import { describe, expect, test } from "bun:test";
import {
  broadcastDashboardReload,
  createSseResponse,
  sseClientCount,
} from "../scripts/lib/dashboard-sse-hub.js";

describe("dashboard-sse-hub", () => {
  test("broadcast reaches connected SSE client", async () => {
    const res = createSseResponse();
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(sseClientCount()).toBe(1);

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    const dec = new TextDecoder();
    let chunk = await reader.read();
    expect(dec.decode(chunk.value)).toContain("event: connected");

    const n = broadcastDashboardReload();
    expect(n).toBe(1);
    chunk = await reader.read();
    expect(dec.decode(chunk.value)).toContain("event: reload");

    await reader.cancel();
    expect(sseClientCount()).toBe(0);
  });
});
