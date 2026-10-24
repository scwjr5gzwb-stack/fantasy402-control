import { join } from "path";
import { evaluateHealth } from "./evaluate-health.js";

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
    pendingTrace: join(base, "pending-rot-leg-trace.json"),
    graphResult: join(base, "graph-result.json"),
    replayLifecycle: join(base, "replay-lifecycle.json"),
    overlayGraded: join(base, "graph-overlay.graded.png"),
  };
}

/** @param {{ ok?: boolean } | null | undefined} manifest @param {{ ok?: boolean } | null | undefined} sidecar */
function mergeReplayLifecycleFromSidecar(manifest, sidecar) {
  if (!sidecar) return manifest ?? null;
  if (!manifest) return sidecar;
  if (manifest.ok && !sidecar.ok) return manifest;
  if (!manifest.ok && sidecar.ok) return sidecar;
  return sidecar.ok === false ? sidecar : manifest;
}

/** @param {string} root @param {Record<string, unknown> | null} manifestRaw */
async function loadReplayLifecycle(root, manifestRaw) {
  const mod = await import(
    join(root, "scripts", "lib", "graph-replay-lifecycle.js")
  );
  const parse = mod.parseReplayLifecycle;
  let lc = parse(manifestRaw?.replayLifecycle);
  const sideFile = Bun.file(artifactPaths(root).replayLifecycle);
  if (await sideFile.exists()) {
    lc = mergeReplayLifecycleFromSidecar(lc ?? undefined, parse(await sideFile.json()) ?? undefined);
  }
  return lc;
}

/**
 * @param {Record<string, unknown> | null} manifest
 * @param {Record<string, unknown> | null} graphSummary
 * @param {Record<string, unknown> | null} pendingTrace
 */
export function buildPendingMetrics(manifest, graphSummary, pendingTrace) {
  const basis = String(manifest?.graphCohort?.basis ?? "");
  const manifestSummary = /** @type {Record<string, unknown>} */ (
    manifest?.summary ?? {}
  );
  const snap = /** @type {Record<string, unknown>} */ (
    manifest?.pendingHtmlSnapshot ?? {}
  );
  const snapshotSkipped =
    basis === "pending" && snap.skipped === true;

  /** @type {Record<string, unknown>} */
  const pending = {
    available: false,
    replayBasis: basis || null,
    legs: null,
    edges: null,
    tickets: null,
    boundRots: null,
    gateFailures: null,
    htmlSnapshotCaptured: Boolean(snap.path),
    htmlSnapshotSkipped: snap.skipped === true,
    htmlSnapshotReason: typeof snap.reason === "string" ? snap.reason : null,
    pendingTracePresent: pendingTrace != null,
    pendingTraceStale: false,
  };

  if (basis === "pending") {
    const src = graphSummary?.rows != null ? graphSummary : manifestSummary;
    pending.legs = src.rows ?? null;
    pending.edges = src.edges ?? null;
    pending.tickets = src.tickets ?? null;
    pending.available = pending.legs != null || pending.edges != null;
  }

  if (pendingTrace && snapshotSkipped) {
    pending.pendingTraceStale = true;
  } else if (pendingTrace) {
    pending.boundRots = pendingTrace.legTraceCount ?? null;
    pending.gateFailures = pendingTrace.gateFailureCount ?? null;
    pending.available = true;
  }

  return pending;
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
    pending: buildPendingMetrics(null, null, null),
    replayCohort: null,
    health: {
      manifestPresent: false,
      tracePresent: false,
      gateFailures: null,
      allGatesPass: null,
      gradedRotCoveragePct: null,
      pipelineReady: null,
    },
  };

  /** @type {Record<string, unknown> | null} */
  let manifestRaw = null;
  const manifestFile = Bun.file(paths.manifest);
  if (await manifestFile.exists()) {
    out.health.manifestPresent = true;
    manifestRaw = await manifestFile.json();
    out.manifest = {
      finishedAt: manifestRaw.finishedAt,
      gitHead: manifestRaw.gitHead,
      liveBuild: manifestRaw.liveBuild,
      validation: manifestRaw.validation,
      graphCohort: manifestRaw.graphCohort,
      summary: manifestRaw.summary,
      pendingHtmlSnapshot: manifestRaw.pendingHtmlSnapshot,
    };
    out.replayCohort = manifestRaw.graphCohort?.basis ?? null;
    const cj = manifestRaw.graphCohort?.cohortJoin;
    out.health.gradedRotCoveragePct = cj?.gradedRotCoveragePct ?? null;
    out.health.pipelineReady =
      manifestRaw.graphCohort?.rowShape?.pipelineReady ?? null;
    out.health.copySignalValid = manifestRaw.graphCohort?.copySignalValid;
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

  /** @type {Record<string, unknown> | null} */
  let pendingTraceRaw = null;
  const pendingTraceFile = Bun.file(paths.pendingTrace);
  if (await pendingTraceFile.exists()) {
    pendingTraceRaw = await pendingTraceFile.json();
    out.pendingTrace = {
      legTraceCount: pendingTraceRaw.legTraceCount,
      gateFailureCount: pendingTraceRaw.gateFailureCount,
      source: pendingTraceRaw.source,
    };
  }

  out.pending = buildPendingMetrics(
    manifestRaw,
    /** @type {Record<string, unknown>} */ (out.graphSummary),
    pendingTraceRaw,
  );

  if (manifestRaw) {
    const replayLifecycle = await loadReplayLifecycle(root, manifestRaw);
    out.replayLifecycle = replayLifecycle;
    if (replayLifecycle) {
      out.health.replayLifecycleOk = replayLifecycle.ok === true;
      out.health.replayPhase = replayLifecycle.phase;
      out.health.replayViolation = replayLifecycle.violation;
      out.health.replayReason = replayLifecycle.reason;
    } else {
      out.health.replayLifecycleOk = null;
      out.health.replayPhase = null;
      out.health.replayViolation = null;
      out.health.replayReason = null;
    }
  }

  const evaluation = evaluateHealth(out, { skillsRoot: out.skillsRoot });
  out.health.overall = evaluation.overall;
  out.health.ok = evaluation.ok;
  out.health.activeAlerts = evaluation.alerts;
  out.health.snapshot = evaluation.snapshot;

  return out;
}

/**
 * Canonical ops snapshot (metrics + embedded health). Prefer over calling evaluateHealth twice.
 *
 * @param {string} [root]
 */
export async function getControlSnapshot(root = skillsRoot()) {
  return loadControlMetrics(root);
}
