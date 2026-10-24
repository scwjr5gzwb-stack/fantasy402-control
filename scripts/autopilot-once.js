#!/usr/bin/env bun
import { join } from "path";
import { runAutopilotTick } from "./lib/run-autopilot-tick.js";

const CONTROL_ROOT = join(import.meta.dir, "..");

const row = await runAutopilotTick(CONTROL_ROOT);
process.exit(row.ok ? 0 : 1);
