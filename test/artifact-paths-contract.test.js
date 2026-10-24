import { describe, expect, test } from "bun:test";
import { join } from "path";
import { artifactPaths, skillsRoot } from "../scripts/lib/load-metrics.js";

describe("artifact-paths contract", () => {
  test("control artifactPaths match skills schema", async () => {
    const root = skillsRoot();
    const schemaPath = join(root, "schema", "artifact-paths.json");
    const schema = JSON.parse(await Bun.file(schemaPath).text());
    const paths = artifactPaths(root);
    const base = join(root, schema.baseDir);
    expect(paths.manifest).toBe(join(base, schema.files.runManifest));
    expect(paths.trace).toBe(join(base, schema.files.gradedRotLegTrace));
    expect(paths.pendingTrace).toBe(
      join(base, schema.files.pendingRotLegTrace),
    );
    expect(paths.graphResult).toBe(join(base, schema.files.graphResult));
  });
});
