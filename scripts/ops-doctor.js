#!/usr/bin/env bun
/**
 * Preflight for local ops — paths, artifacts, env, dashboard, optional gh release.
 *
 *   bun run doctor
 */
import { join } from "path";
import { loadControlMetrics, skillsRoot } from "./lib/load-metrics.js";

const CONTROL_ROOT = join(import.meta.dir, "..");

/** @param {string} label @param {boolean} ok @param {string} [detail] */
function line(label, ok, detail) {
  const mark = ok ? "ok" : "FAIL";
  console.log(`${mark.padEnd(4)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function checkDashboard() {
  const host = process.env.DASHBOARD_HOST?.trim() || "127.0.0.1";
  const port = process.env.DASHBOARD_PORT?.trim() || "4020";
  const url = `http://${host}:${port}/api/metrics`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return { ok: res.ok, detail: res.ok ? url : `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: `not reachable (${msg}); bun run dashboard` };
  }
}

async function softReleaseVerify(root) {
  const script = join(root, "scripts", "release-github.js");
  if (!(await Bun.file(script).exists())) return { ok: true, detail: "n/a" };
  const proc = Bun.spawnSync(
    [process.execPath, script, "verify", "--tag", "v1.0.0-graded-cohort"],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (proc.success) return { ok: true, detail: "gh release visible" };
  return {
    ok: true,
    detail: "gh release not verified (tag may exist without Release object)",
  };
}

const root = skillsRoot();
const envLocal = Bun.file(join(CONTROL_ROOT, ".env.local"));
line("fantasy402-control .env.local", await envLocal.exists());

const skillsDir = Bun.file(join(root, "package.json"));
line("FANTASY402_SKILLS_ROOT", await skillsDir.exists(), root);

const metrics = await loadControlMetrics(root);
line("run-manifest.json", metrics.health.manifestPresent);
line("graded-rot-leg-trace.json", metrics.health.tracePresent);
line(
  "pending-rot-leg-trace.json",
  Boolean(metrics.pending?.pendingTracePresent),
);
line(
  "pending-rows.snapshot.html",
  await Bun.file(
    join(root, "artifacts", "graph-webview", "pending-rows.snapshot.html"),
  ).exists(),
);

const tg =
  Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()) &&
  Boolean(process.env.TELEGRAM_CHAT_ID?.trim());
line(
  "Telegram credentials",
  true,
  tg ? "configured" : "optional — not set",
);

const dash = await checkDashboard();
line("dashboard /api/metrics", dash.ok, dash.detail);

const release = await softReleaseVerify(root);
line("release verify", release.ok, release.detail);

const alerts = /** @type {Array<Record<string, unknown>>} */ (
  metrics.health.activeAlerts ?? []
);
console.log("");
if (alerts.length === 0 && metrics.health.ok === true) {
  console.log("health: green");
  process.exit(0);
}

console.log(
  `health: ${metrics.health.ok ? "amber" : "not ok"} (${alerts.length} alert(s))`,
);
for (const a of alerts) {
  console.log(`  [${a.severity}] ${a.code}: ${a.message}`);
  if (a.remediation) console.log(`    → ${a.remediation}`);
}
const hasCritical = alerts.some((a) => a.severity === "critical");
process.exit(hasCritical || metrics.health.overall === "red" ? 1 : 0);
