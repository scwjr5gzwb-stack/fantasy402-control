#!/usr/bin/env bun
/**
 * In-process Bun.cron metrics poll + log-only alerts.
 *
 *   bun run autopilot
 */
import { join } from "path";
import {
  assertPollScheduleParsable,
  pollCronConfigFromEnv,
} from "./lib/cron-env.js";
import { runAutopilotTick } from "./lib/run-autopilot-tick.js";

const CONTROL_ROOT = join(import.meta.dir, "..");
const { schedule, tz } = pollCronConfigFromEnv();
assertPollScheduleParsable(schedule, tz);

let ticking = false;

/** @type {import("bun").CronJob | undefined} */
let job;

async function tick(label) {
  if (ticking) {
    console.warn(`[autopilot] skip ${label} — prior tick still running`);
    return;
  }
  ticking = true;
  try {
    await runAutopilotTick(CONTROL_ROOT);
  } catch (e) {
    console.error(
      "[autopilot] tick failed:",
      e instanceof Error ? e.message : e,
    );
  } finally {
    ticking = false;
  }
}

job = Bun.cron(
  schedule,
  async () => {
    await tick("cron");
  },
  { tz },
);

console.log(
  `[autopilot] polling ${schedule} (${tz}); next ${Bun.cron.parse(schedule, Date.now(), { tz })?.toISOString()}`,
);
console.log(
  `[autopilot] skills root via FANTASY402_SKILLS_ROOT or sibling default`,
);

await tick("startup");

const shutdown = () => {
  console.log("\n[autopilot] stopping");
  job?.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

job.ref();
