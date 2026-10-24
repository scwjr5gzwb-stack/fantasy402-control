#!/usr/bin/env bun
import { join } from "path";
import { runAutopilotTick } from "./lib/run-autopilot-tick.js";

const CONTROL_ROOT = join(import.meta.dir, "..");
const dryRun = process.argv.includes("--dry-run");

const row = await runAutopilotTick(CONTROL_ROOT, { dryRun });
process.exit(row.ok ? 0 : 1);
