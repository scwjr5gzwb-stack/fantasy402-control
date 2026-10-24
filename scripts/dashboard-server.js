#!/usr/bin/env bun
import { cohortJoinCardModel, coverageCardModel } from "./lib/dashboard-coverage.js";
import {
  renderSyndicateRowHtml,
  verdictClientScript,
  verdictRulesBootstrapScript,
} from "./lib/dashboard-verdict.js";
import { loadControlMetrics, skillsRoot } from "./lib/load-metrics.js";
import { loadPairDrill } from "./lib/load-pair-drill.js";
import { isSafeLoginSegment } from "./lib/pair-route-guard.js";
import {
  broadcastDashboardReload,
  createSseResponse,
} from "./lib/dashboard-sse-hub.js";
import { runAutopilotTick } from "./lib/run-autopilot-tick.js";
import {
  autopilotTickShouldSkip,
  autopilotTickSkipReason,
  markAutopilotTickRan,
} from "./lib/autopilot-tick-guard.js";

const PORT = Number(process.env.DASHBOARD_PORT ?? 4020);
const HOST = process.env.DASHBOARD_HOST ?? "127.0.0.1";

function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

/** @param {unknown} n */
function fmtNum(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-US");
}

/** @param {unknown} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @param {Array<Record<string, unknown>>} top */
function renderSyndicateRows(top) {
  if (top.length === 0) {
    return '<tr><td colspan="9" style="text-align: center;">No syndicates flagged.</td></tr>';
  }
  return top
    .map((t) =>
      renderSyndicateRowHtml(/** @type {import("./lib/dashboard-verdict.js").TopPair} */ (t), escapeHtml),
    )
    .join("");
}

/** @param {Record<string, unknown>} m */
function renderHtml(m) {
  const h = /** @type {Record<string, unknown>} */ (m.health ?? {});
  const manifest = /** @type {Record<string, unknown>} */ (m.manifest ?? {});
  const gc = /** @type {Record<string, unknown>} */ (
    manifest.graphCohort ?? {}
  );
  const summary = /** @type {Record<string, unknown>} */ (m.graphSummary ?? {});
  const topSyndicates = /** @type {Array<Record<string, unknown>>} */ (
    Array.isArray(m.syndicateTop)
      ? m.syndicateTop
      : Array.isArray(summary.top)
        ? summary.top
        : []
  );
  const syndicateRows = renderSyndicateRows(topSyndicates);
  const syndicateCaption = String(m.syndicateCaption ?? "");
  const parityMismatches = /** @type {string[] | undefined} */ (
    h.artifactSummaryMismatches
  );
  const topParityWarn =
    h.artifactSummaryParity === false
      ? (parityMismatches?.length
          ? parityMismatches.join(" · ")
          : "run-manifest and graph-result disagree.")
      : "";
  const coverage = coverageCardModel(m);
  const cohortJoin = cohortJoinCardModel(m);
  const lastUpdatedAt = new Date(String(m.loadedAt)).toLocaleTimeString();
  const badge =
    h.overall === "green" ? "ok" : h.overall === "amber" ? "warn" : "bad";
  const pending = /** @type {Record<string, unknown>} */ (m.pending ?? {});
  const pendingGraphLive = pending.available === true;
  const pendingDomStale = pending.pendingTraceStale === true;
  const pendingSnapshotSkipped = pending.htmlSnapshotSkipped === true;
  const pendingWarn =
    pending.replayBasis === "pending" && pendingSnapshotSkipped;
  const pendingCardClass = pendingWarn
    ? "pending-warn"
    : pendingGraphLive
      ? "pending-live"
      : "pending-off";
  const pendingPill = pendingWarn
    ? "warn"
    : pendingGraphLive
      ? "live"
      : "off";
  const pendingPillText = pendingWarn
    ? "Snapshot missing"
    : pendingGraphLive
      ? "Live"
      : "Offline";
  const replayBasis = String(m.replayCohort ?? gc.basis ?? "—");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fantasy402 Graded Control</title>
  <style>
    :root { --bg:#0f1419; --panel:#1a2332; --text:#e7ecf3; --muted:#8b9cb3; --ok:#22c55e; --warn:#f59e0b; --bad:#ef4444; --unknown:#a855f7; --accent:#38bdf8; }
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
    .card.pending-live { border-left: 4px solid var(--ok); }
    .card.pending-warn { border-left: 4px solid var(--warn); }
    .card.pending-off { border-left: 4px solid var(--muted); }
    .pill { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .pill.live { color: var(--ok); }
    .pill.warn { color: var(--warn); }
    .pill.off { color: var(--muted); }
    .card h2 { margin: 0 0 0.65rem; font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
    .metric { font-size: 1.65rem; font-weight: 650; font-variant-numeric: tabular-nums; }
    .sub { color: var(--muted); font-size: 12px; margin-top: 0.35rem; }
    dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.35rem 0.75rem; font-size: 13px; }
    dt { color: var(--muted); }
    footer { padding: 0 1.5rem 1.5rem; color: var(--muted); font-size: 12px; }
    a { color: var(--accent); }
    code { font-size: 12px; }
    .syndicate-wrap { padding: 0 1.5rem 1.5rem; }
    .syndicate-wrap h2 { margin: 0 0 0.5rem; font-size: 1rem; font-weight: 600; }
    #syndicate-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-family: ui-monospace, monospace; font-size: 13px; }
    #syndicate-table th, #syndicate-table td { padding: 8px; border: 1px solid #243044; text-align: left; }
    #syndicate-table thead tr { background: #121a26; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    #last-updated { text-align: right; font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; }
  </style>
</head>
<body>
  <header>
    <h1>Fantasy402 — Graded &amp; pending control</h1>
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
      <h2>${escapeHtml(coverage.title)}</h2>
      <div class="metric">${escapeHtml(coverage.metric)}</div>
      <div class="sub">${escapeHtml(coverage.sub)}</div>
      ${coverage.hint ? `<div class="sub">${escapeHtml(coverage.hint)}</div>` : ""}
    </section>
    <section class="card">
      <h2>Last graph replay (${escapeHtml(replayBasis)})</h2>
      <div class="metric">${fmtNum(summary.rows)} legs</div>
      <div class="sub">${fmtNum(summary.edges)} edges · build ${manifest.liveBuild ?? "—"}</div>
    </section>
    <section class="card ${pendingCardClass}">
      <h2>Pending graph <span class="pill ${pendingPill}">${pendingPillText}</span></h2>
      <div class="metric">${fmtNum(pending.legs)} legs</div>
      <div class="sub">${fmtNum(pending.edges)} edges · DOM rots ${pendingDomStale ? "— (stale trace)" : fmtNum(pending.boundRots)}</div>
      <div class="sub">HTML snapshot: ${pending.htmlSnapshotCaptured ? "yes" : pending.htmlSnapshotSkipped ? "skipped" : "—"}${pending.htmlSnapshotReason ? ` (${escapeHtml(String(pending.htmlSnapshotReason).slice(0, 48))})` : ""}</div>
    </section>
    <section class="card">
      <h2>${escapeHtml(cohortJoin.title)}</h2>
      <dl>
        ${cohortJoin.rows
          .map(
            (r) =>
              `<dt>${escapeHtml(r.label)}</dt><dd>${escapeHtml(r.value)}</dd>`,
          )
          .join("\n        ")}
      </dl>
      ${cohortJoin.hint ? `<div class="sub">${escapeHtml(cohortJoin.hint)}</div>` : ""}
    </section>
  </main>
  <section class="syndicate-wrap">
    <h2>Top coordinated syndicates</h2>
    <div id="syndicate-caption" class="sub">${escapeHtml(syndicateCaption)}</div>
    ${topParityWarn ? `<div class="sub" style="color: var(--unknown);">${escapeHtml(topParityWarn)}</div>` : ""}
    <div id="last-updated">Last updated: ${lastUpdatedAt}</div>
    <table id="syndicate-table">
      <thead>
        <tr>
          <th>Pair (A / B)</th>
          <th>Games</th>
          <th>Same</th>
          <th>Opp</th>
          <th>Lead</th>
          <th>sub1h</th>
          <th>medΔ</th>
          <th>leadF</th>
          <th>Verdict</th>
        </tr>
      </thead>
      <tbody id="syndicate-body">
        ${syndicateRows}
      </tbody>
    </table>
    <p class="sub">Verdict suffix: S = zero sub-1h samples (coordinated); O = more opp than same. medΔ color: &lt;5m tight, 5–30m delayed, 30–60m slow, UNVERIFIED = sentinel.</p>
  </section>
  <footer>
    Snapshot ${String(m.loadedAt)} · API <a href="/api/metrics">/api/metrics</a> ·
    Refresh replay: <code>FANTASY402_GRAPH_COHORT=graded bun run graph:replay</code> in fantasy402-skills
  </footer>
  ${verdictRulesBootstrapScript()}
  <script>${verdictClientScript()}</script>
  <script>
    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    async function updateSyndicates() {
      try {
        const res = await fetch("/api/metrics");
        const data = await res.json();
        const tbody = document.getElementById("syndicate-body");
        const top = data.syndicateTop || data.graphSummary?.top || [];
        const renderRow = window.__dashboardVerdict.renderSyndicateRow;

        if (top.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="9" style="text-align: center;">No syndicates flagged.</td></tr>';
        } else {
          tbody.innerHTML = top.map((t) => renderRow(t, escapeHtml)).join("");
        }

        const cap = document.getElementById("syndicate-caption");
        if (cap && data.syndicateCaption) cap.textContent = data.syndicateCaption;

        document.getElementById("last-updated").textContent =
          "Last updated: " + new Date().toLocaleTimeString();
      } catch (err) {
        console.error("Failed to update syndicates:", err);
      }
    }

    setInterval(updateSyndicates, 10000);

    const sse = new EventSource("/api/events");
    sse.addEventListener("reload", () => window.location.reload());
    sse.onerror = () => {
      /* EventSource reconnects automatically */
    };
  </script>
</body>
</html>`;
}

/** @param {Request} req */
function reloadTriggerAuthorized(req) {
  const token = process.env.FANTASY402_DASHBOARD_RELOAD_TOKEN?.trim();
  if (!token) return true;
  return req.headers.get("x-reload-token") === token;
}

/** @param {Request} req */
export async function dispatch(req) {
  const url = new URL(req.url);
  if (url.pathname === "/api/events") {
    return createSseResponse();
  }
  if (url.pathname === "/api/trigger-reload" && req.method === "POST") {
    if (!reloadTriggerAuthorized(req)) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const clients = broadcastDashboardReload();
    return Response.json({ ok: true, clients });
  }
  if (url.pathname === "/api/autopilot/tick" && req.method === "POST") {
    if (!reloadTriggerAuthorized(req)) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (autopilotTickShouldSkip()) {
      return Response.json({
        ok: true,
        skipped: true,
        reason: autopilotTickSkipReason(),
      });
    }
    const row = await runAutopilotTick();
    markAutopilotTickRan();
    return Response.json({
      ok: row.ok === true,
      skipped: false,
      overall: row.snapshot?.overall ?? null,
      alertCount: row.alerts?.length ?? 0,
    });
  }
  if (url.pathname === "/api/metrics") {
    const m = await loadControlMetrics();
    return Response.json(m);
  }
  if (url.pathname === "/api/pair" && req.method === "GET") {
    const loginA = url.searchParams.get("a");
    const loginB = url.searchParams.get("b");
    if (!loginA || !loginB) {
      return Response.json(
        { ok: false, error: "missing_query", need: "a,b" },
        { status: 400 },
      );
    }
    if (!isSafeLoginSegment(loginA) || !isSafeLoginSegment(loginB)) {
      return Response.json(
        { ok: false, error: "invalid_login_segment" },
        { status: 400 },
      );
    }
    const body = await loadPairDrill(loginA.trim(), loginB.trim());
    if (body.ok === false) {
      return Response.json(body, { status: 404 });
    }
    return Response.json(body);
  }
  if (url.pathname === "/health") {
    return Response.json({ ok: true, skillsRoot: skillsRoot() });
  }
  const m = await loadControlMetrics();
  return new Response(renderHtml(m), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** @param {Request} req */
async function fetchWithRouteLog(req) {
  const t0 = Bun.nanoseconds();
  try {
    return await dispatch(req);
  } finally {
    console.log(
      JSON.stringify({
        method: req.method,
        pathname: new URL(req.url).pathname,
        duration_ms: (Bun.nanoseconds() - t0) / 1e6,
      }),
    );
  }
}

if (import.meta.main) {
  const server = Bun.serve({
    hostname: HOST,
    port: PORT,
    fetch: fetchWithRouteLog,
  });

  console.log(
    `Dashboard http://${HOST}:${server.port}/  (skills: ${skillsRoot()})`,
  );
}
