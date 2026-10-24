import { join } from "path";

/** @returns {string} */
export function skillsRoot() {
  const raw =
    process.env.FANTASY402_SKILLS_ROOT?.trim() ||
    join(import.meta.dir, "..", "..", "..", "fantasy402-skills");
  return raw.replace(/\/$/, "");
}

/** @param {string} root */
export function artifactPaths(root) {
  const base = join(root, "artifacts", "graph-webview");
  return {
    manifest: join(base, "run-manifest.json"),
    trace: join(base, "graded-rot-leg-trace.json"),
    graphResult: join(base, "graph-result.json"),
    overlayGraded: join(base, "graph-overlay.graded.png"),
  };
}

/**
 * @param {string} [root]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function loadControlMetrics(root = skillsRoot()) {
  const paths = artifactPaths(root);
  /** @type {Record<string, unknown>} */
  const out = {
    skillsRoot: root,
    loadedAt: new Date().toISOString(),
    paths,
    manifest: null,
    trace: null,
    graphSummary: null,
    health: {
      manifestPresent: false,
      tracePresent: false,
      gateFailures: null,
      allGatesPass: null,
      gradedRotCoveragePct: null,
      pipelineReady: null,
    },
  };

  const manifestFile = Bun.file(paths.manifest);
  if (await manifestFile.exists()) {
    out.health.manifestPresent = true;
    const manifest = await manifestFile.json();
    out.manifest = {
      finishedAt: manifest.finishedAt,
      gitHead: manifest.gitHead,
      liveBuild: manifest.liveBuild,
      validation: manifest.validation,
      graphCohort: manifest.graphCohort,
    };
    const cj = manifest.graphCohort?.cohortJoin;
    out.health.gradedRotCoveragePct = cj?.gradedRotCoveragePct ?? null;
    out.health.pipelineReady =
      manifest.graphCohort?.rowShape?.pipelineReady ?? null;
    out.health.copySignalValid = manifest.graphCohort?.copySignalValid;
  }

  const traceFile = Bun.file(paths.trace);
  if (await traceFile.exists()) {
    out.health.tracePresent = true;
    const trace = await traceFile.json();
    out.trace = {
      gateFailureCount: trace.gateFailureCount,
      legTraceCount: trace.legTraceCount,
      rotSourceNoneCount: trace.rotSourceNoneCount,
      rotSourceNoneExcludedExpected: trace.rotSourceNoneExcludedExpected,
    };
    out.health.gateFailures = trace.gateFailureCount ?? null;
    out.health.allGatesPass = (trace.gateFailureCount ?? 0) === 0;
  }

  const graphFile = Bun.file(paths.graphResult);
  if (await graphFile.exists()) {
    const g = await graphFile.json();
    out.graphSummary = g.summary ?? g;
  }

  out.health.overall =
    out.health.manifestPresent &&
    out.health.tracePresent &&
    out.health.allGatesPass === true
      ? "green"
      : out.health.manifestPresent || out.health.tracePresent
        ? "amber"
        : "red";

  return out;
}
