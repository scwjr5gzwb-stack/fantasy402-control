import { describe, expect, test } from "bun:test";
import { join } from "path";
import { skillsRoot } from "../scripts/lib/load-metrics.js";

describe("artifact-paths sync", () => {
  test("control copy matches skills schema", async () => {
    const controlPath = join(import.meta.dir, "..", "schema", "artifact-paths.json");
    const skillsPath = join(skillsRoot(), "schema", "artifact-paths.json");
    const control = await Bun.file(controlPath).text();
    const skills = await Bun.file(skillsPath).text();
    const strip = (s) => {
      const o = JSON.parse(s);
      delete o._sync;
      return JSON.stringify(o);
    };
    expect(strip(control)).toBe(strip(skills));
  });
});
