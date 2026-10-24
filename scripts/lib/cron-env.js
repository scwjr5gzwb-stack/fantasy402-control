const DEFAULT_POLL_SCHEDULE = "*/15 * * * *";
const DEFAULT_TZ = "America/Chicago";

/** @returns {{ schedule: string, tz: string }} */
export function pollCronConfigFromEnv(env = process.env) {
  const schedule =
    env.FANTASY402_CRON_POLL_SCHEDULE?.trim() || DEFAULT_POLL_SCHEDULE;
  const tz = env.FANTASY402_CRON_TZ?.trim() || DEFAULT_TZ;
  return { schedule, tz };
}

/**
 * @param {string} schedule
 * @param {string} tz
 * @param {number} [fromMs]
 */
export function assertPollScheduleParsable(schedule, tz, fromMs = Date.now()) {
  if (typeof Bun.cron?.parse !== "function") {
    throw new Error("Bun.cron.parse is unavailable (need Bun >= 1.3.11)");
  }
  const next = Bun.cron.parse(schedule, fromMs, { tz });
  if (!next) throw new Error(`Invalid cron schedule: ${schedule}`);
  return next;
}
