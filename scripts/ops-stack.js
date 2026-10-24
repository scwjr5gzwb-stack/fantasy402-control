#!/usr/bin/env bun
/**
 * Run dashboard + autopilot together (one terminal).
 *
 *   bun run ops
 */
import { join } from "path";

const CONTROL_ROOT = join(import.meta.dir, "..");
const bun = process.execPath;
const envFile = join(CONTROL_ROOT, ".env.local");

/** @type {import("bun").Subprocess[]} */
const children = [];

function spawn(name, script) {
  const child = Bun.spawn([bun, "--env-file", envFile, script], {
    cwd: CONTROL_ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  children.push(child);
  console.log(`[ops-stack] started ${name} (pid ${child.pid})`);
  return child;
}

spawn("dashboard", "scripts/dashboard-server.js");
spawn("autopilot", "scripts/autopilot-daemon.js");

const shutdown = () => {
  console.log("\n[ops-stack] stopping");
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* already dead */
    }
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.race(children.map((c) => c.exited)).then((code) => {
  console.error(`[ops-stack] child exited with ${code}`);
  shutdown();
});
