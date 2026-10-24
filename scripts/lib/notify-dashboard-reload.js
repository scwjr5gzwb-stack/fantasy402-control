import { dashboardAuthHeaders, dashboardBaseUrl } from "./dashboard-url.js";

/**
 * POST /api/trigger-reload on the local dashboard (SSE broadcast to browsers).
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function notifyDashboardReload(env = process.env) {
  if (env.FANTASY402_DASHBOARD_RELOAD === "0") {
    return { skipped: true, reason: "disabled" };
  }

  const url = `${dashboardBaseUrl(env)}/api/trigger-reload`;
  const headers = dashboardAuthHeaders(env);

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
