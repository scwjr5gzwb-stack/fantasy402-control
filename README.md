# fantasy402-control

Cursor project for **graded cohort operations**: local dashboard + **Grok** ops bot, reading artifacts from [fantasy402-skills](https://github.com/scwjr5gzwb-stack/fantasy402-skills).

## Setup

```bash
cd ~/fantasy402-control
direnv allow   # once — avoids sibling fantasy402-skills PATH hijacking git
bash scripts/setup-local-git.sh
cp .env.example .env.local
# Edit FANTASY402_SKILLS_ROOT and XAI_API_KEY
```

Open the multi-root workspace in Cursor:

```bash
cursor fantasy402-graded.code-workspace
```

## Dashboard

```bash
bun run dashboard
# http://127.0.0.1:4020/
```

Shows rot gate status, `gradedRotCoveragePct`, last replay summary from `run-manifest.json` and `graded-rot-leg-trace.json`.

## Grok bot

```bash
bun run bot
bun run bot:once "Summarize graded health and what to run if coverage drops"
```

Uses xAI (`XAI_API_KEY`) with embedded metrics JSON — no secrets from skills repo are sent except artifact counts already on disk.

## Refresh upstream data

In **fantasy402-skills**:

```bash
bun --env-file=.env.local rots run
bun rots gate --dry-run
FANTASY402_GRAPH_COHORT=graded bun run graph:replay
```

Reload the dashboard to see updated metrics.

## Autopilot (Bun.cron hybrid)

Requires **Bun ≥ 1.4.4**.

1. In **fantasy402-skills**, register the daily OS replay job:

   ```bash
   bun run graded:cron:install
   bun run graded:cron:status
   ```

2. In **fantasy402-control**, run the in-process metrics poller (log-only alerts under `artifacts/autopilot/`):

   ```bash
   bun run autopilot          # long-lived; polls FANTASY402_CRON_POLL_SCHEDULE
   bun run autopilot:once     # single health check (exit 0 only when green)
   ```

   Run **`bun run dashboard`** separately for the UI. Alerts log to **`artifacts/autopilot/alerts.jsonl`** when `gateFailures > 0`, artifacts are missing, or `gradedRotCoveragePct` is below **`FANTASY402_COVERAGE_ALERT_MIN`** (default `0.80`). For **`replayCohort: pending`**: **AMBER** `pending_snapshot_missing` / `pending_parse_empty`; **RED** `pending_parse_failed` when HTML was captured but **`pending-rot-leg-trace.json`** is absent.

   Optional **Telegram** (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`): deduped RED/AMBER notifications from the same tick path. Preview without sending:

   ```bash
   bun run autopilot:once --dry-run
   ```

## Release tag

Parser + graded integration: **`v1.0.0-graded-cohort`** on fantasy402-skills (`373da5f`).
