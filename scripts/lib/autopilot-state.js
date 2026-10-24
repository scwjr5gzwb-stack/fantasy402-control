import { join } from "path";
import { mkdirSync } from "fs";

/** @returns {string} */
export function autopilotArtifactsDir(
  controlRoot = join(import.meta.dir, "..", ".."),
) {
  return join(controlRoot, "artifacts", "autopilot");
}

/**
 * @param {Record<string, unknown>} state
 * @param {string} [controlRoot]
 */
export async function writeAutopilotState(state, controlRoot) {
  const dir = autopilotArtifactsDir(controlRoot);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "state.json");
  await Bun.write(path, JSON.stringify(state, null, 2));
  return path;
}

/**
 * @param {Record<string, unknown>} alertRow
 * @param {string} [controlRoot]
 */
export async function appendAutopilotAlert(alertRow, controlRoot) {
  const dir = autopilotArtifactsDir(controlRoot);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "alerts.jsonl");
  const line = `${JSON.stringify(alertRow)}\n`;
  const file = Bun.file(path);
  const prev = (await file.exists()) ? await file.text() : "";
  await Bun.write(path, prev + line);
  return path;
}
