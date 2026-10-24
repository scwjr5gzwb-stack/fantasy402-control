/**
 * POST /api/trigger-reload on the local dashboard (SSE broadcast to browsers).
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function notifyDashboardReload(env = process.env) {
  if (env.FANTASY402_DASHBOARD_RELOAD === "0") {
    return { skipped: true, reason: "disabled" };
  }

  const explicit = env.FANTASY402_DASHBOARD_RELOAD_URL?.trim();
  const host = env.DASHBOARD_HOST?.trim() || "127.0.0.1";
  const port = env.DASHBOARD_PORT?.trim() || "4020";
  const url =
    explicit || `http://${host}:${port}/api/trigger-reload`;

  const headers = /** @type {Record<string, string>} */ ({});
  const token = env.FANTASY402_DASHBOARD_RELOAD_TOKEN?.trim();
  if (token) headers["x-reload-token"] = token;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { skipped: false, ok: false, status: res.status, body: text };
    }
    const body = await res.json();
    return { skipped: false, ok: true, ...body };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { skipped: false, ok: false, error: msg };
  }
}
