#!/usr/bin/env bun
import { loadControlMetrics, skillsRoot } from "./lib/load-metrics.js";

const PORT = Number(process.env.DASHBOARD_PORT ?? 4020);
const HOST = process.env.DASHBOARD_HOST ?? "127.0.0.1";

function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

/** @param {Record<string, unknown>} m */
function renderHtml(m) {
  const h = /** @type {Record<string, unknown>} */ (m.health ?? {});
  const manifest = /** @type {Record<string, unknown>} */ (m.manifest ?? {});
  const gc = /** @type {Record<string, unknown>} */ (
    manifest.graphCohort ?? {}
  );
  const cj = /** @type {Record<string, unknown>} */ (gc.cohortJoin ?? {});
  const summary = /** @type {Record<string, unknown>} */ (m.graphSummary ?? {});
  const badge =
    h.overall === "green" ? "ok" : h.overall === "amber" ? "warn" : "bad";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fantasy402 Graded Control</title>
  <style>
    :root { --bg:#0f1419; --panel:#1a2332; --text:#e7ecf3; --muted:#8b9cb3; --ok:#22c55e; --warn:#f59e0b; --bad:#ef4444; --accent:#38bdf8; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); }
    header { padding: 1.25rem 1.5rem; border-bottom: 1px solid #243044; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    h1 { font-size: 1.1rem; margin: 0; font-weight: 600; }
    .badge { padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .badge.ok { background: #14532d; color: #bbf7d0; }
    .badge.warn { background: #78350f; color: #fde68a; }
    .badge.bad { background: #7f1d1d; color: #fecaca; }
    main { padding: 1.25rem 1.5rem 2rem; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .card { background: var(--panel); border: 1px solid #243044; border-radius: 10px; padding: 1rem 1.1rem; }
    .card h2 { margin: 0 0 0.65rem; font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
    .metric { font-size: 1.65rem; font-weight: 650; font-variant-numeric: tabular-nums; }
    .sub { color: var(--muted); font-size: 12px; margin-top: 0.35rem; }
    dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.35rem 0.75rem; font-size: 13px; }
    dt { color: var(--muted); }
    footer { padding: 0 1.5rem 1.5rem; color: var(--muted); font-size: 12px; }
    a { color: var(--accent); }
    code { font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>Fantasy402 — Graded cohort control</h1>
    <span class="badge ${badge}">${String(h.overall ?? "unknown")}</span>
    <span class="sub">Skills root: <code>${String(m.skillsRoot)}</code></span>
  </header>
  <main>
    <section class="card">
      <h2>Rot parser gates</h2>
      <div class="metric">${h.allGatesPass === true ? "PASS" : h.allGatesPass === false ? "FAIL" : "—"}</div>
      <div class="sub">gateFailures: ${h.gateFailures ?? "—"}</div>
    </section>
    <section class="card">
      <h2>Coverage</h2>
      <div class="metric">${pct(cj.gradedRotCoveragePct)}</div>
      <div class="sub">${cj.gradedLegsWithBoundRot ?? "—"} bound / ${cj.gradedInfoSampled ?? "—"} sampled</div>
    </section>
    <section class="card">
      <h2>Graph replay</h2>
      <div class="metric">${summary.rows ?? "—"} legs</div>
      <div class="sub">${summary.edges ?? "—"} edges · build ${manifest.liveBuild ?? "—"}</div>
    </section>
    <section class="card">
      <h2>Cohort join</h2>
      <dl>
        <dt>strategy</dt><dd>${cj.joinStrategy ?? "—"}</dd>
        <dt>ambiguous keys</dt><dd>${cj.ambiguousAmountKeys ?? "—"}</dd>
        <dt>timing suppressed</dt><dd>${cj.timingVerdictsSuppressed ?? "—"}</dd>
        <dt>pipelineReady</dt><dd>${h.pipelineReady ?? "—"}</dd>
      </dl>
    </section>
  </main>
  <footer>
    Snapshot ${String(m.loadedAt)} · API <a href="/api/metrics">/api/metrics</a> ·
    Refresh replay: <code>FANTASY402_GRAPH_COHORT=graded bun run graph:replay</code> in fantasy402-skills
  </footer>
</body>
</html>`;
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/metrics") {
      const m = await loadControlMetrics();
      return Response.json(m);
    }
    if (url.pathname === "/health") {
      return Response.json({ ok: true, skillsRoot: skillsRoot() });
    }
    const m = await loadControlMetrics();
    return new Response(renderHtml(m), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});

console.log(
  `Dashboard http://${HOST}:${server.port}/  (skills: ${skillsRoot()})`,
);
