import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { join } from "path";
import { isSafeLoginSegment } from "../scripts/lib/pair-route-guard.js";
import { dispatch } from "../scripts/dashboard-server.js";

const TRAVERSAL = ["..", "../x", "..%2f", "a/b", "%2e%2e"];

describe("pair-route-guard", () => {
  test("rejects known traversal payloads including ..", () => {
    for (const s of TRAVERSAL) {
      expect(isSafeLoginSegment(s)).toBe(false);
    }
    expect(isSafeLoginSegment("..")).toBe(false);
  });

  test("accepts typical login ids", () => {
    expect(isSafeLoginSegment("BYT107")).toBe(true);
    expect(isSafeLoginSegment("KYM150")).toBe(true);
  });

  test("traversal guard property (seed 42, 10 runs; .. explicit)", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(".."),
          fc.constantFrom(...TRAVERSAL),
          fc.string({ minLength: 1, maxLength: 32 }),
        ),
        (s) => {
          const lower = s.toLowerCase();
          const unsafe =
            s === ".." ||
            s.includes("..") ||
            s.includes("/") ||
            s.includes("\\") ||
            lower.includes("%2e") ||
            lower.includes("%2f") ||
            lower.includes("%5c");
          if (unsafe) return isSafeLoginSegment(s) === false;
          const wouldBeSafe =
            /^[A-Za-z0-9_-]+$/.test(s) && s.length <= 64 && s.length > 0;
          return isSafeLoginSegment(s) === wouldBeSafe;
        },
      ),
      { numRuns: 10, seed: 42 },
    );
  });
});

describe("dispatch /api/pair traversal (integration)", () => {
  test("returns 400 for .. via dispatch", async () => {
    const res = await dispatch(
      new Request("http://127.0.0.1:4020/api/pair?a=..&b=BYT107"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_login_segment");
  });

  test("returns JSON for valid pair query via dispatch", async () => {
    const res = await dispatch(
      new Request("http://127.0.0.1:4020/api/pair?a=BYT107&b=KYM150"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.inSummaryTop).not.toBeNull();
  });

  test("dispatch calls isSafeLoginSegment before loadPairDrill (regression)", async () => {
    const src = await Bun.file(
      join(import.meta.dir, "../scripts/dashboard-server.js"),
    ).text();
    const pairBlock = src.slice(
      src.indexOf('url.pathname === "/api/pair"'),
      src.indexOf('url.pathname === "/health"'),
    );
    expect(pairBlock.indexOf("isSafeLoginSegment")).toBeGreaterThan(-1);
    expect(pairBlock.indexOf("loadPairDrill")).toBeGreaterThan(-1);
    expect(pairBlock.indexOf("isSafeLoginSegment")).toBeLessThan(
      pairBlock.indexOf("loadPairDrill"),
    );
  });
});
