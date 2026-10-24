import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadPairDrill,
  resetPairDrillCacheForTests,
} from "../scripts/lib/load-pair-drill.js";

describe("loadPairDrill cache", () => {
  test("invalidates graph cache when graph-result mtime changes", async () => {
    resetPairDrillCacheForTests();
    const root = mkdtempSync(join(tmpdir(), "pair-drill-cache-"));
    const base = join(root, "artifacts", "graph-webview");
    mkdirSync(base, { recursive: true });
    const graphPath = join(base, "graph-result.json");

    const v1 = {
      summary: {
        snapshot_id: "snap-v1",
        rows: 1,
        edges: 1,
        flagged: 0,
        top: [{ a: "AAA1", b: "BBB2", verdict: "public" }],
      },
      topEdges: [],
    };
    writeFileSync(graphPath, JSON.stringify(v1));

    const first = await loadPairDrill("AAA1", "BBB2", root);
    expect(first.ok).toBe(true);
    expect(first.snapshot_id).toBe("snap-v1");

    const v2 = {
      ...v1,
      summary: { ...v1.summary, snapshot_id: "snap-v2" },
    };
    writeFileSync(graphPath, JSON.stringify(v2));
    const bump = new Date(Date.now() + 60_000);
    utimesSync(graphPath, bump, bump);

    const second = await loadPairDrill("AAA1", "BBB2", root);
    expect(second.snapshot_id).toBe("snap-v2");
    expect(second.cache?.graphMtimeMs).toBeGreaterThanOrEqual(
      first.cache?.graphMtimeMs ?? 0,
    );
  });
});
