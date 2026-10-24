---
name: fantasy402-control
description: >-
  Operates the fantasy402-control Cursor project — graded cohort dashboard,
  Grok ops bot, and metrics loader reading fantasy402-skills artifacts. Use when
  working on dashboard-server, grok-bot, workspace setup, or ops monitoring for
  gradedRotCoveragePct and gateFailures.
---

# fantasy402-control

## Layout

- `scripts/lib/load-metrics.js` — reads `run-manifest.json`, `graded-rot-leg-trace.json`
- `scripts/dashboard-server.js` — Bun.serve UI + `/api/metrics`
- `scripts/grok-bot.js` — xAI chat with metrics context
- `fantasy402-graded.code-workspace` — multi-root with fantasy402-skills

## Env

- `FANTASY402_SKILLS_ROOT` — path to skills clone
- `XAI_API_KEY`, `XAI_MODEL` — Grok bot
- `DASHBOARD_PORT` (default 4020)

## Health semantics

- **green**: manifest + trace present, `gateFailureCount === 0`
- **amber**: partial artifacts
- **red**: missing artifacts

Do not duplicate parser logic here — fix gates in skills repo, refresh artifacts, reload dashboard.
