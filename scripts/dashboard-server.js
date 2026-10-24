#!/usr/bin/env bun
import { loadControlMetrics, skillsRoot } from "./lib/load-metrics.js";

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

/** @param {unknown} verdict */
function verdictStyle(verdict) {
  const v = String(verdict ?? "").toLowerCase();
  if (v === "coordinated" || v === "copying") {
    return "color: var(--bad); font-weight: 600;";
  }
  if (v === "lean" || v === "steam") {
    return "color: var(--warn); font-weight: 600;";
  }
  return "color: var(--ok); font-weight: 600;";
}

/** @param {Array<Record<string, unknown>>} top */
function renderSyndicateRows(top) {
  if (top.length === 0) {
    return '<tr><td colspan="6" style="text-align: center;">No syndicates flagged.</td></tr>';
  }
  return top
    .map((t) => {
      const style = verdictStyle(t.verdict);
      const label = escapeHtml(String(t.verdict ?? "").toUpperCase());
      return `<tr>
      <td>${escapeHtml(t.a)} / ${escapeHtml(t.b)}</td>
      <td>${escapeHtml(t.sameGames)}</td>
      <td>${escapeHtml(t.same)}</td>
      <td>${escapeHtml(t.opp)}</td>
      <td>${escapeHtml(t.lead)}</td>
      <td style="${style}">${label}</td>
    </tr>`;
    })
    .join("");
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
  const topSyndicates = /** @type {Array<Record<string, unknown>>} */ (
    Array.isArray(summary.top) ? summary.top : []
  );
  const syndicateRows = renderSyndicateRows(topSyndicates);
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
      <h2>Coverage</h2>
      <div class="metric">${pct(cj.gradedRotCoveragePct)}</div>
      <div class="sub">${cj.gradedLegsWithBoundRot ?? "—"} bound / ${cj.gradedInfoSampled ?? "—"} sampled</div>
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
      <h2>Cohort join</h2>
      <dl>
        <dt>strategy</dt><dd>${cj.joinStrategy ?? "—"}</dd>
        <dt>ambiguous keys</dt><dd>${cj.ambiguousAmountKeys ?? "—"}</dd>
        <dt>timing suppressed</dt><dd>${cj.timingVerdictsSuppressed ?? "—"}</dd>
        <dt>pipelineReady</dt><dd>${h.pipelineReady ?? "—"}</dd>
      </dl>
    </section>
  </main>
  <section class="syndicate-wrap">
    <h2>Top coordinated syndicates</h2>
    <div id="last-updated">Last updated: ${lastUpdatedAt}</div>
    <table id="syndicate-table">
      <thead>
        <tr>
          <th>Pair (A / B)</th>
          <th>Games</th>
          <th>Same</th>
          <th>Opp</th>
          <th>Lead</th>
          <th>Verdict</th>
        </tr>
      </thead>
      <tbody id="syndicate-body">
        ${syndicateRows}
      </tbody>
    </table>
  </section>
  <footer>
    Snapshot ${String(m.loadedAt)} · API <a href="/api/metrics">/api/metrics</a> ·
    Refresh replay: <code>FANTASY402_GRAPH_COHORT=graded bun run graph:replay</code> in fantasy402-skills
  </footer>
  <script>
    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function verdictStyle(verdict) {
      const v = String(verdict ?? "").toLowerCase();
      if (v === "coordinated" || v === "copying") {
        return "color: var(--bad); font-weight: 600;";
      }
      if (v === "lean" || v === "steam") {
        return "color: var(--warn); font-weight: 600;";
      }
      return "color: var(--ok); font-weight: 600;";
    }

    async function updateSyndicates() {
      try {
        const res = await fetch("/api/metrics");
        const data = await res.json();
        const tbody = document.getElementById("syndicate-body");
        const top = data.graphSummary?.top || [];

        if (top.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="6" style="text-align: center;">No syndicates flagged.</td></tr>';
          return;
        }

        tbody.innerHTML = top
          .map((t) => {
            const style = verdictStyle(t.verdict);
            const label = escapeHtml(String(t.verdict ?? "").toUpperCase());
            return (
              "<tr>" +
              "<td>" +
              escapeHtml(t.a) +
              " / " +
              escapeHtml(t.b) +
              "</td>" +
              "<td>" +
              escapeHtml(t.sameGames) +
              "</td>" +
              "<td>" +
              escapeHtml(t.same) +
              "</td>" +
              "<td>" +
              escapeHtml(t.opp) +
              "</td>" +
              "<td>" +
              escapeHtml(t.lead) +
              "</td>" +
              '<td style="' +
              style +
              '">' +
              label +
              "</td>" +
              "</tr>"
            );
          })
          .join("");

        document.getElementById("last-updated").textContent =
          "Last updated: " + new Date().toLocaleTimeString();
      } catch (err) {
        console.error("Failed to update syndicates:", err);
      }
    }

    setInterval(updateSyndicates, 10000);
  </script>
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
