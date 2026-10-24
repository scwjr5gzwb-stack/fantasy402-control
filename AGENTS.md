# Agents — fantasy402-control

This repo is the **ops layer** for the graded graph cohort. Implementation lives in **fantasy402-skills**.

| Task                          | Where                                                                |
| ----------------------------- | -------------------------------------------------------------------- |
| Rot parser, gates, `bun rots` | `../fantasy402-skills` — `fantasy402-graded-rot.md`                  |
| Graph replay, manifest        | `FANTASY402_GRAPH_COHORT=graded bun run graph:replay` in skills repo |
| Dashboard / Grok bot          | This repo — `scripts/dashboard-server.js`, `scripts/grok-bot.js`     |

Read `.cursor/skills/fantasy402-control/SKILL.md` when changing dashboard or bot behavior.
