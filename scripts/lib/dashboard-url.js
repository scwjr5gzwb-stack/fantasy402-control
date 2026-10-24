/** @param {NodeJS.ProcessEnv} [env] */
export function dashboardBaseUrl(env = process.env) {
  const explicit = env.FANTASY402_DASHBOARD_RELOAD_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/api\/trigger-reload\/?$/, "");
  }
  const host = env.DASHBOARD_HOST?.trim() || "127.0.0.1";
  const port = env.DASHBOARD_PORT?.trim() || "4020";
  return `http://${host}:${port}`;
}

/** @param {NodeJS.ProcessEnv} [env] */
export function dashboardAuthHeaders(env = process.env) {
  const headers = /** @type {Record<string, string>} */ ({});
  const token = env.FANTASY402_DASHBOARD_RELOAD_TOKEN?.trim();
  if (token) headers["x-reload-token"] = token;
  return headers;
}
