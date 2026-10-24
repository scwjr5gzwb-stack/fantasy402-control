#!/usr/bin/env bun
import { cohortJoinCardModel, coverageCardModel } from "./lib/dashboard-coverage.js";
import {
  renderSyndicateRowHtml,
  verdictClientScript,
  verdictRulesBootstrapScript,
} from "./lib/dashboard-verdict.js";
import { loadControlMetrics, skillsRoot } from "./lib/load-metrics.js";
import { loadLoginHub } from "./lib/load-login-hub.js";
import { loadPairDrill } from "./lib/load-pair-drill.js";
import { isSafeLoginSegment } from "./lib/pair-route-guard.js";
import {
  renderPairApiJsonBrowserHtml,
  renderPairDrillClientErrorHtml,
  renderPairDrillHtml,
} from "./lib/render-pair-drill-html.js";
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
  const replayPhase =
    typeof h.replayPhase === "string" ? h.replayPhase : null;
  const replayLcOk = h.replayLifecycleOk;
  const replayPill =
    replayLcOk === true ? "ok" : replayLcOk === false ? "bad" : "off";
  const replayPillText =
    replayLcOk === true
      ? "complete"
      : replayLcOk === false
        ? String(h.replayViolation ?? "error")
        : replayPhase
          ? replayPhase
          : "legacy";
  const replaySub =
    replayLcOk === false && h.replayReason
      ? `<div class="sub">${escapeHtml(String(h.replayReason).slice(0, 120))}</div>`
      : "";
  const skillsRootPath = String(m.skillsRoot ?? "");
  const skillsRootShort =
    skillsRootPath.split("/").filter(Boolean).pop() ?? skillsRootPath;
  const healthLabel = String(h.overall ?? "unknown");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fantasy402 Graded Control</title>
  <style>
    :root {
      --bg:#0f1419; --panel:#1a2332; --text:#e7ecf3; --muted:#8b9cb3; --meta:#b8c5d9;
      --ok:#22c55e; --warn:#f59e0b; --bad:#ef4444; --unknown:#a855f7; --accent:#38bdf8;
      --med-tight:#fca5a5; --med-delayed:#fcd34d; --med-slow:#fb923c;
      --med-unverified:#c084fc; --med-beyond:#94a3b8;
      --card-heading:#a8b8d0;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); padding-bottom: 3rem; }
    header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #243044;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem 2rem;
      flex-wrap: wrap;
      min-height: 67px;
    }
    .header-brand { flex: 1 1 16rem; min-width: 0; }
    h1 { font-size: 1.1rem; margin: 0; font-weight: 600; line-height: 1.3; }
    .header-status {
      flex: 0 1 auto;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.65rem;
      margin-left: auto;
      padding: 0.15rem 0 0.15rem 1.25rem;
    }
    @media (max-width: 640px) {
      .header-status { align-items: flex-start; padding-left: 0; width: 100%; }
    }
    .header-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      color: var(--meta);
      font-size: 12px;
      line-height: 1.4;
      max-width: min(100%, 42rem);
    }
    .header-meta-label {
      color: var(--muted);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .header-meta code {
      color: #e2e8f0;
      background: #2a3548;
      border: 1px solid #3d4f6a;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 28rem;
    }
    .badge { padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .badge.ok { background: #14532d; color: #bbf7d0; }
    .badge.warn { background: #92400e; color: #fef3c7; border: 1px solid #fbbf24; }
    .badge.bad { background: #7f1d1d; color: #fecaca; }
    main { padding: 1.25rem 1.5rem 2rem; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .card { background: var(--panel); border: 1px solid #243044; border-radius: 10px; padding: 1rem 1.25rem; border-left: 4px solid #243044; }
    .card.card-gates { border-left-color: var(--accent); display: flex; flex-direction: column; min-height: 7.5rem; }
    .card.card-gates .card-metric-block { flex: 1; display: flex; flex-direction: column; justify-content: center; margin-top: 0.25rem; }
    .card.card-coverage { border-left-color: var(--warn); }
    .card.card-replay { border-left-color: var(--unknown); }
    .card.pending-live { border-left-color: var(--ok); }
    .card.pending-warn { border-left-color: var(--warn); }
    .card.pending-off { border-left-color: var(--muted); }
    .card.card-cohort { border-left-color: var(--accent); }
    .pill { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .pill.live { color: var(--ok); }
    .pill.warn { color: var(--warn); }
    .pill.off { color: var(--muted); }
    .pill.ok { color: var(--ok); }
    .pill.bad { color: var(--bad); }
    .card h2 { margin: 0 0 0.65rem; font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--card-heading); font-weight: 650; }
    .metric { font-size: 1.65rem; font-weight: 650; font-variant-numeric: tabular-nums; }
    .sub { color: var(--muted); font-size: 12px; margin-top: 0.35rem; line-height: 1.55; }
    .sub-stack .sub + .sub { margin-top: 0.5rem; padding-top: 0.35rem; border-top: 1px solid #243044; }
    .card-cohort dl { margin: 0; display: grid; grid-template-columns: minmax(7rem, 42%) 1fr; gap: 0.4rem 1rem; font-size: 13px; align-items: baseline; padding-right: 0.15rem; }
    .card-cohort dt { color: var(--muted); margin: 0; }
    .card-cohort dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; word-break: break-word; padding-right: 0.1rem; }
    footer { padding: 0 1.5rem 2.25rem; color: var(--meta); font-size: 13px; line-height: 1.55; position: relative; z-index: 2; }
    footer code { color: #cbd5e1; }
    a { color: var(--accent); }
    code { font-size: 12px; }
    .syndicate-wrap { padding: 0 1.5rem 1.5rem; }
    .syndicate-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.5rem 1rem; margin-bottom: 0.35rem; }
    .syndicate-head h2 { margin: 0; font-size: 1rem; font-weight: 600; }
    #last-updated { font-size: 0.8rem; color: var(--meta); font-variant-numeric: tabular-nums; white-space: nowrap; }
    #syndicate-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-family: ui-monospace, monospace; font-size: 13px; table-layout: fixed; }
    #syndicate-table th, #syndicate-table td { padding: 8px 10px; border-bottom: 1px solid #2d3a4f; }
    #syndicate-table thead tr { background: #121a26; color: var(--meta); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    #syndicate-table th { position: sticky; top: 0; z-index: 1; white-space: nowrap; border-bottom: 1px solid #3d4f6a; }
    #syndicate-table th.num, #syndicate-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    #syndicate-table td.med { text-align: center; min-width: 3.25rem; }
    #syndicate-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    #syndicate-table tbody tr.pair-row { cursor: pointer; transition: background 0.12s ease, box-shadow 0.12s ease; }
    #syndicate-table tbody tr.pair-row:hover, #syndicate-table tbody tr.pair-row:focus-visible {
      background: rgba(255, 255, 255, 0.06);
      box-shadow: inset 3px 0 0 var(--accent);
      outline: none;
    }
    .col-pair { text-align: left; width: 16%; max-width: 11rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pair-label { display: inline-block; color: #7dd3fc; text-decoration: none; border-bottom: 1px solid transparent; transition: color 0.12s, border-color 0.12s; }
    tr.pair-row:hover .pair-label, tr.pair-row:focus-visible .pair-label { color: var(--accent); border-bottom-color: var(--accent); }
    .pair-chevron { float: right; color: var(--accent); opacity: 0.35; font-size: 14px; transition: opacity 0.12s; }
    tr.pair-row:hover .pair-chevron, tr.pair-row:focus-visible .pair-chevron { opacity: 1; }
    #syndicate-table td.col-verdict, #syndicate-table th:last-child { text-align: right; }
    #syndicate-table td.med.med-tier-tight { color: var(--med-tight) !important; font-weight: 600; }
    #syndicate-table td.med.med-tier-delayed { color: var(--med-delayed) !important; font-weight: 600; }
    #syndicate-table td.med.med-tier-slow { color: var(--med-slow) !important; font-weight: 600; }
    #syndicate-table td.med.med-tier-unverified { color: var(--med-unverified) !important; font-weight: 600; font-style: italic; }
    #syndicate-table td.med.med-tier-na { color: var(--med-beyond) !important; font-weight: 500; }
    .verdict-copying { color: #f87171; font-weight: 700; }
    .verdict-coordinated { color: #fb7185; font-weight: 600; font-style: italic; }
    .verdict-lean { color: #fbbf24; font-weight: 600; }
    .verdict-public { color: #86efac; font-weight: 600; }
    .verdict-unknown { color: var(--unknown); font-weight: 600; font-style: italic; }
    .table-legend { margin: 1rem 0 0; padding: 0.75rem 1rem; background: var(--panel); border: 1px solid #243044; border-radius: 8px; line-height: 1.55; position: relative; z-index: 1; list-style: none; display: flex; flex-wrap: wrap; gap: 0.65rem 1.25rem; font-size: 12px; }
    .table-legend li { margin: 0; padding: 0; max-width: 36rem; }
    .table-legend strong { color: var(--text); }
    .table-legend .legend-sep { color: #3d4f6a; user-select: none; }
  </style>
</head>
<body>
  <header>
    <div class="header-brand">
      <h1>Fantasy402 — Graded &amp; pending control</h1>
    </div>
    <div class="header-status">
      <span class="badge ${badge}" role="status" aria-label="Overall health: ${escapeHtml(healthLabel)}">${escapeHtml(healthLabel)}</span>
      <p class="header-meta">
        <span class="header-meta-label">Skills root</span>
        <code title="${escapeHtml(skillsRootPath)}">${escapeHtml(skillsRootShort)}</code>
      </p>
    </div>
  </header>
  <main>
    <section class="card card-gates">
      <h2>Rot parser gates</h2>
      <div class="card-metric-block">
        <div class="metric">${h.allGatesPass === true ? "PASS" : h.allGatesPass === false ? "FAIL" : "—"}</div>
        <div class="sub">gateFailures: ${h.gateFailures ?? "—"}</div>
      </div>
    </section>
    <section class="card card-coverage">
      <h2>${escapeHtml(coverage.title)}</h2>
      <div class="metric">${escapeHtml(coverage.metric)}</div>
      <div class="sub-stack">
        <div class="sub">${escapeHtml(coverage.sub)}</div>
        ${coverage.hint ? `<div class="sub">${escapeHtml(coverage.hint)}</div>` : ""}
      </div>
    </section>
    <section class="card card-replay">
      <h2>Last graph replay (${escapeHtml(replayBasis)}) <span class="pill ${replayPill}">${escapeHtml(replayPillText)}</span></h2>
      <div class="metric">${fmtNum(summary.rows)} legs</div>
      <div class="sub">${fmtNum(summary.edges)} edges · build ${manifest.liveBuild ?? "—"}${replayPhase && replayLcOk !== false ? ` · phase ${escapeHtml(replayPhase)}` : ""}</div>
      ${replaySub}
    </section>
    <section class="card ${pendingCardClass}">
      <h2>Pending graph <span class="pill ${pendingPill}">${pendingPillText}</span></h2>
      <div class="metric">${fmtNum(pending.legs)} legs</div>
      <div class="sub">${fmtNum(pending.edges)} edges · DOM rots ${pendingDomStale ? "— (stale trace)" : fmtNum(pending.boundRots)}</div>
      <div class="sub">HTML snapshot: ${pending.htmlSnapshotCaptured ? "yes" : pending.htmlSnapshotSkipped ? "skipped" : "—"}${pending.htmlSnapshotReason ? ` (${escapeHtml(String(pending.htmlSnapshotReason).slice(0, 48))})` : ""}</div>
    </section>
    <section class="card card-cohort">
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
    <div class="syndicate-head">
      <h2>Top coordinated syndicates</h2>
      <div id="last-updated">Last updated: ${lastUpdatedAt}</div>
    </div>
    <div id="syndicate-caption" class="sub">${escapeHtml(syndicateCaption)}</div>
    ${topParityWarn ? `<div class="sub" style="color: var(--unknown);">${escapeHtml(topParityWarn)}</div>` : ""}
    <table id="syndicate-table">
      <thead>
        <tr>
          <th class="col-pair">Pair (A / B)</th>
          <th class="num">Games</th>
          <th class="num">Same</th>
          <th class="num">Opp</th>
          <th>Lead</th>
          <th class="num" title="Sub-1-hour sample count">sub1h</th>
          <th class="num med" title="Median delta (medΔ)">medΔ</th>
          <th class="num" title="Lead fraction">leadF</th>
          <th class="col-verdict">Verdict</th>
        </tr>
      </thead>
      <tbody id="syndicate-body">
        ${syndicateRows}
      </tbody>
    </table>
    <ul class="table-legend sub" aria-label="Table legend">
      <li><strong>Verdicts:</strong> S = zero sub-1h samples (coordinated); O = more opp than same.</li>
      <li class="legend-sep" aria-hidden="true">•</li>
      <li><strong>medΔ:</strong> &lt;5m tight (red) · 5–30m delayed (gold) · 30–60m slow (amber) · &gt;60m beyond (slate) · UNV = unverified (purple; tooltip has full label).</li>
      <li class="legend-sep" aria-hidden="true">•</li>
      <li><strong>Interaction:</strong> Click a syndicate row to open pair drill — <a href="/pair?a=BYT107&amp;b=KYM150">example</a> (<a href="/api/pair?a=BYT107&amp;b=KYM150&amp;format=json">JSON</a>).</li>
    </ul>
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
        wirePairRows();

        const cap = document.getElementById("syndicate-caption");
        if (cap && data.syndicateCaption) cap.textContent = data.syndicateCaption;

        document.getElementById("last-updated").textContent =
          "Last updated: " + new Date().toLocaleTimeString();
      } catch (err) {
        console.error("Failed to update syndicates:", err);
      }
    }

    function openPairDrill(a, b) {
      const url =
        "/pair?a=" +
        encodeURIComponent(a) +
        "&b=" +
        encodeURIComponent(b);
      window.open(url, "_blank", "noopener,noreferrer");
    }

    function wirePairRows() {
      document.querySelectorAll("#syndicate-body tr.pair-row").forEach((tr) => {
        tr.addEventListener("click", () => {
          openPairDrill(tr.dataset.a, tr.dataset.b);
        });
        tr.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            openPairDrill(tr.dataset.a, tr.dataset.b);
          }
        });
      });
    }

    wirePairRows();
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

/** Document navigation (browser tab), not curl/fetch API clients. */
function isBrowserDocumentNavigation(req) {
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json") && !accept.includes("text/html")) {
    return false;
  }
  if (accept.includes("text/html")) return true;
  const mode = req.headers.get("sec-fetch-mode");
  const dest = req.headers.get("sec-fetch-dest");
  return mode === "navigate" || dest === "document";
}

/** Browser tab to /api/pair without format=json → redirect to /pair HTML drill. */
function requestPrefersPairHtml(req, url) {
  if (url.searchParams.get("format") === "json") return false;
  return isBrowserDocumentNavigation(req);
}

/** Human drill-down: indented JSON in a new tab (metrics stay compact). */
function pairDrillJsonResponse(body, status, htmlAlternateHref) {
  /** @type {Record<string, string>} */
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (htmlAlternateHref) {
    headers.Link = `<${htmlAlternateHref}>; rel="alternate"; type="text/html"`;
  }
  return new Response(`${JSON.stringify(body, null, 2)}\n`, { status, headers });
}

/**
 * @param {URL} url
 */
async function pairDrillFromQuery(url) {
  const loginA = url.searchParams.get("a")?.trim() ?? "";
  const loginB = url.searchParams.get("b")?.trim() ?? "";
  if (!loginA || !loginB) {
    return {
      status: 400,
      body: { ok: false, error: "missing_query", need: "a,b" },
      loginA: loginA ?? "",
      loginB: loginB ?? "",
    };
  }
  if (!isSafeLoginSegment(loginA) || !isSafeLoginSegment(loginB)) {
    return {
      status: 400,
      body: { ok: false, error: "invalid_login_segment" },
      loginA,
      loginB,
    };
  }
  const a = loginA.trim();
  const b = loginB.trim();
  const body = await loadPairDrill(a, b);
  return {
    status: body.ok === false ? 404 : 200,
    body,
    loginA: a,
    loginB: b,
  };
}

/**
 * @param {URL} url
 */
async function loginHubFromQuery(url) {
  const login = url.searchParams.get("login")?.trim() ?? "";
  if (!login) {
    return {
      status: 400,
      body: { ok: false, error: "missing_query", need: "login" },
    };
  }
  if (!isSafeLoginSegment(login)) {
    return {
      status: 400,
      body: { ok: false, error: "invalid_login_segment" },
    };
  }
  const body = await loadLoginHub(login);
  return {
    status: body.ok === false ? 404 : 200,
    body,
  };
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
  if (url.pathname === "/api/login" && req.method === "GET") {
    const { status, body } = await loginHubFromQuery(url);
    return pairDrillJsonResponse(body, status, null);
  }
  if (
    (url.pathname === "/api/pair" || url.pathname === "/pair") &&
    req.method === "GET"
  ) {
    const { status, body, loginA, loginB } = await pairDrillFromQuery(url);
    if (url.pathname === "/api/pair") {
      const wantsJson = url.searchParams.get("format") === "json";
      const browserDoc = isBrowserDocumentNavigation(req);
      if (wantsJson && browserDoc) {
        const html =
          body.ok === false
            ? renderPairDrillClientErrorHtml(body, loginA, loginB)
            : renderPairApiJsonBrowserHtml(body, loginA, loginB);
        return new Response(html, {
          status,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      if (!wantsJson && requestPrefersPairHtml(req, url)) {
        const qs = new URLSearchParams(url.searchParams);
        qs.delete("format");
        const q = qs.toString();
        return Response.redirect(q ? `/pair?${q}` : "/pair", 302);
      }
      if (!wantsJson || !browserDoc) {
        const htmlAlt =
          loginA && loginB
            ? `/pair?a=${encodeURIComponent(loginA)}&b=${encodeURIComponent(loginB)}`
            : null;
        return pairDrillJsonResponse(body, status, htmlAlt);
      }
    }
    const html =
      body.ok === false
        ? renderPairDrillClientErrorHtml(body, loginA, loginB)
        : renderPairDrillHtml(body, loginA, loginB, skillsRoot());
    return new Response(html, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
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
