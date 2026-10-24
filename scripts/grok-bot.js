#!/usr/bin/env bun
/**
 * Grok ops bot — answers questions using live graded metrics context.
 *
 *   bun run bot
 *   bun run bot:once "Is graded coverage healthy?"
 */
import { loadControlMetrics } from "./lib/load-metrics.js";

const SYSTEM = `You are the Fantasy402 graded cohort ops assistant.
You help interpret rot-parser gates, graph replay manifests, and bun rots CLI health.
Be concise. If metrics show gateFailures > 0 or coverage far below 85%, recommend bun rots gate and bun rots trace.
Never invent ticket numbers or counts — only use numbers from the METRICS JSON.`;

async function askGrok(userMessage, metricsJson) {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    console.error("Set XAI_API_KEY in .env.local (see .env.example)");
    process.exit(1);
  }
  const model = process.env.XAI_MODEL?.trim() || "grok-4-7-fast-non-reasoning";
  const extra = process.env.GROK_SYSTEM_EXTRA?.trim() ?? "";

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `${SYSTEM}${extra ? `\n\n${extra}` : ""}\n\nMETRICS:\n${metricsJson}`,
        },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Grok API ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "(empty response)";
}

async function main() {
  const once = process.argv.includes("--once");
  const metrics = await loadControlMetrics();
  const metricsJson = JSON.stringify(metrics, null, 2);

  if (once) {
    const q = process.argv
      .filter((a) => a !== "--once")
      .join(" ")
      .trim();
    if (!q) {
      console.error('Usage: bun run bot:once "your question"');
      process.exit(1);
    }
    console.log(await askGrok(q, metricsJson));
    return;
  }

  console.log("Grok ops bot (graded cohort). Empty line to exit.\n");
  const stdin = Bun.stdin.stream();
  const reader = stdin.getReader();
  const dec = new TextDecoder();
  /** @type {string} */
  let buf = "";
  process.stdout.write("you> ");
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value);
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) {
        reader.releaseLock();
        return;
      }
      try {
        const answer = await askGrok(line, metricsJson);
        console.log("\ngrok>", answer, "\n");
      } catch (e) {
        console.error(e instanceof Error ? e.message : e);
      }
      process.stdout.write("you> ");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
