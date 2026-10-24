import { join } from "path";
import { artifactPaths, skillsRoot } from "./load-metrics.js";

/** @param {string} a @param {string} b @param {unknown} x @param {unknown} y */
function pairMatches(a, b, x, y) {
  return (x === a && y === b) || (x === b && y === a);
}

const LEGS_SAMPLE_CAP = 20;

/** @type {{ graphMtime: number, graph: Record<string, unknown> | null }} */
let graphCache = { graphMtime: -1, graph: null };

/** @type {{ traceMtime: number, legs: Record<string, unknown>[] | null }} */
let traceLegsCache = { traceMtime: -1, legs: null };

/**
 * @param {string} path
 */
async function fileMtimeMs(path) {
  const f = Bun.file(path);
  if (!(await f.exists())) return null;
  return f.lastModified;
}

/**
 * @param {string} graphPath
 */
async function loadGraphCached(graphPath) {
  const mtime = await fileMtimeMs(graphPath);
  if (mtime == null) return null;
  if (graphCache.graphMtime === mtime && graphCache.graph) {
    return graphCache.graph;
  }
  const graph = await Bun.file(graphPath).json();
  graphCache = { graphMtime: mtime, graph };
  return graph;
}

/**
 * @param {string} tracePath
 */
async function loadTraceLegsCached(tracePath) {
  const mtime = await fileMtimeMs(tracePath);
  if (mtime == null) return null;
  if (traceLegsCache.traceMtime === mtime && traceLegsCache.legs) {
    return traceLegsCache.legs;
  }
  const trace = await Bun.file(tracePath).json();
  const legs = Array.isArray(trace.legs) ? trace.legs : [];
  traceLegsCache = { traceMtime: mtime, legs };
  return legs;
}

/** Test hook — reset in-memory artifact caches. */
export function resetPairDrillCacheForTests() {
  graphCache = { graphMtime: -1, graph: null };
  traceLegsCache = { traceMtime: -1, legs: null };
}

/**
 * Pair summary (pair-drill shape) + bounded leg sample from graded trace.
 *
 * @param {string} loginA
 * @param {string} loginB
 * @param {string} [root]
 */
export async function loadPairDrill(loginA, loginB, root = skillsRoot()) {
  const paths = artifactPaths(root);
  const graph = await loadGraphCached(paths.graphResult);
  if (!graph) {
    return {
      ok: false,
      error: "missing_graph_result",
      path: paths.graphResult,
    };
  }

  const summary = /** @type {Record<string, unknown>} */ (graph.summary ?? {});
  /** @type {Record<string, unknown>[]} */
  const top = Array.isArray(summary.top) ? summary.top : [];
  /** @type {Record<string, unknown>[]} */
  const topEdges = Array.isArray(graph.topEdges) ? graph.topEdges : [];

  const inTop = top.find((p) => pairMatches(loginA, loginB, p.a, p.b));
  const inTopEdges = topEdges.find((p) =>
    pairMatches(loginA, loginB, p.a, p.b),
  );

  /** @type {Record<string, unknown>[]} */
  let legsSample = [];
  let legsMatchingCount = 0;
  let legsSampleNote = null;

  const legs = await loadTraceLegsCached(paths.trace);
  if (!legs) {
    legsSampleNote = "graded-rot-leg-trace.json not present";
  } else {
    const logins = new Set([loginA, loginB]);
    /** @type {Record<string, unknown>[]} */
    const matching = [];
    for (const leg of legs) {
      const login = leg.login;
      if (typeof login !== "string" || !logins.has(login)) continue;
      legsMatchingCount++;
      if (matching.length < LEGS_SAMPLE_CAP) {
        matching.push({
          ticket: leg.ticket,
          itemNumber: leg.itemNumber,
          login: leg.login,
          rotSource: leg.rotSource,
          rotBind: leg.rotBind,
          marketType: leg.marketType,
        });
      }
    }
    legsSample = matching;
    if (legsMatchingCount === 0) {
      legsSampleNote =
        "no legs in graded trace sample for either login (sample is capped at gradedLegsSampled)";
    }
  }

  const note = inTop
    ? "Pair is in summary.top (sameGames sort in artifact)."
    : inTopEdges
      ? "Pair is in topEdges but not summary.top — busy but not in top-15 slice."
      : "Pair not in summary.top or topEdges — try lower minGames or full edge dump.";

  return {
    ok: true,
    loginA,
    loginB,
    snapshot_id: summary.snapshot_id,
    summary: {
      rows: summary.rows,
      edges: summary.edges,
      flagged: summary.flagged ?? summary.flaggedTotal,
    },
    inSummaryTop: inTop ?? null,
    inTopEdges: inTopEdges ?? null,
    note,
    legsMatchingCount,
    legsSampleCap: LEGS_SAMPLE_CAP,
    legsSample,
    legsSampleNote,
    cache: {
      graphMtimeMs: graphCache.graphMtime,
      traceMtimeMs: traceLegsCache.traceMtime,
    },
  };
}
