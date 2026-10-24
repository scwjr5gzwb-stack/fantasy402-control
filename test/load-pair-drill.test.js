import { describe, expect, test } from "bun:test";
import {
  loadPairDrill,
  resetPairDrillCacheForTests,
} from "../scripts/lib/load-pair-drill.js";
import { skillsRoot } from "../scripts/lib/load-metrics.js";

describe("loadPairDrill cache", () => {
  test("reloads graph when cache reset (mtime invalidation hook)", async () => {
    resetPairDrillCacheForTests();
    const root = skillsRoot();
    const a = await loadPairDrill("BYT107", "KYM150", root);
    expect(a.ok).toBe(true);
    const mtime1 = a.cache?.graphMtimeMs;
    resetPairDrillCacheForTests();
    const b = await loadPairDrill("BYT107", "KYM150", root);
    expect(b.cache?.graphMtimeMs).toBe(mtime1);
  });
});
