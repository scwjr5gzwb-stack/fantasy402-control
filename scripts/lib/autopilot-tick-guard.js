const DEFAULT_MIN_MS = 5 * 60 * 1000;

/** @type {number} */
let lastSuccessfulTickAt = 0;

/** @param {NodeJS.ProcessEnv} [env] */
function minIntervalMs(env = process.env) {
  const raw = env.FANTASY402_AUTOPILOT_TICK_MIN_MS?.trim();
  const n = raw ? Number(raw) : DEFAULT_MIN_MS;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_MS;
}

/** @param {NodeJS.ProcessEnv} [env] */
export function autopilotTickShouldSkip(env = process.env) {
  const minMs = minIntervalMs(env);
  if (minMs === 0) return false;
  return Date.now() - lastSuccessfulTickAt < minMs;
}

export function markAutopilotTickRan() {
  lastSuccessfulTickAt = Date.now();
}

/** @param {NodeJS.ProcessEnv} [env] */
export function autopilotTickSkipReason(env = process.env) {
  const minMs = minIntervalMs(env);
  return `tick already ran within ${Math.round(minMs / 1000)}s`;
}
