/** Max Fantasy402 login id length (path segment guard). */
export const LOGIN_SEGMENT_MAX_LEN = 64;

const SAFE_LOGIN = /^[A-Za-z0-9_-]+$/;

/**
 * Reject traversal / path injection before reading artifacts.
 * @param {unknown} raw
 */
export function isSafeLoginSegment(raw) {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length === 0 || s.length > LOGIN_SEGMENT_MAX_LEN) return false;
  if (s.includes("..") || s.includes("/") || s.includes("\\")) return false;
  if (/%2e|%2f|%5c/i.test(s)) return false;
  try {
    const dec = decodeURIComponent(s);
    if (dec.includes("..") || dec.includes("/") || dec.includes("\\")) {
      return false;
    }
  } catch {
    return false;
  }
  return SAFE_LOGIN.test(s);
}
