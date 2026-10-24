import { join } from "path";
import { artifactPaths } from "./load-metrics.js";

/**
 * If pending HTML exists on disk but trace is missing, run skills parse-pending.
 *
 * @param {string} skillsRoot
 * @returns {Promise<{ healed: boolean, legTraceCount?: number, error?: string }>}
 */
export async function tryHealPendingParseFromSnapshot(skillsRoot) {
  if (process.env.FANTASY402_AUTOPILOT_HEAL_PARSE_PENDING === "0") {
    return { healed: false };
  }

  const paths = artifactPaths(skillsRoot);
  const htmlPath = join(
    skillsRoot,
    "artifacts",
    "graph-webview",
    "pending-rows.snapshot.html",
  );
  const htmlFile = Bun.file(htmlPath);
  const traceFile = Bun.file(paths.pendingTrace);

  if (!(await htmlFile.exists())) {
    return { healed: false };
  }
  if (await traceFile.exists()) {
    return { healed: false };
  }

  const bun = process.execPath;
  console.log("[autopilot] heal: pending HTML on disk, trace missing — parse-pending");
  const proc = Bun.spawnSync(
    [bun, "rots", "parse-pending", "--write-trace"],
    {
      cwd: skillsRoot,
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (!proc.success) {
    const err = proc.stderr?.toString().trim() || proc.stdout?.toString().trim();
    return { healed: false, error: err || `exit ${proc.exitCode}` };
  }

  if (!(await traceFile.exists())) {
    return { healed: false, error: "parse-pending exited 0 but trace still missing" };
  }

  const trace = await traceFile.json();
  const legTraceCount = trace.legTraceCount;
  console.log(
    `[autopilot] heal: wrote pending trace (${legTraceCount ?? "?"} legs)`,
  );
  return {
    healed: true,
    legTraceCount:
      typeof legTraceCount === "number" ? legTraceCount : undefined,
  };
}
