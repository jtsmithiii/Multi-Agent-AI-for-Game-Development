# Tank Battle: Build Instructions

Tank Battle is a persistent 2D top-down online tank war for up to 20 players. Four color teams raid each other's depots for enemy-colored Energy Cells, and the team with the most Cells in its depot after five rounds wins. The full design is in `docs/GDD.md`; if anything here conflicts with it, the design document wins.

## How the build works
Twenty single-purpose agents live in `.claude/agents/`. Each does exactly one job. They run in seven waves (0 to 6), **no more than three agents at the same time**, and the Lead Agent works between waves, never alongside them.

Claude Code subagents cannot start other subagents, so you (the main session) launch each wave:
1. Run the `lead-agent` to write `handoffs/wave-<n>-briefs.md` for the next wave.
2. Launch that wave's agents (three at most, in parallel) and give each its brief.
3. When they finish, run the `lead-agent` again to read the handoff notes and check that the pieces fit.
4. Fix any conflicts it finds before starting the next wave.

## Checkpoints: nothing moves on until it works
Every task in `docs/task-list.md` has a test. There are two kinds of gate:
- **(you test) tasks** are visual or playable features (the Splash, the Menu, the HUD, the art, the sounds, and similar). Run exactly that one task, alone, with one agent. When it finishes, show the user the **How to test** steps from the handoff note and STOP. Do not start the next task until the user replies `approved <task ID>`. Example: the Splash Screen (`UI-1`) must be approved before the Menu Screen (`UI-2`) is started.
- **Wave gate** tasks are backend work with automated tests. They can run in parallel (up to three agents). At the end of the wave, run the Lead Agent's check, run the tests, show the user the wave checkpoint from `docs/task-list.md`, and STOP until the user replies `approved wave <n>`.

Rules for the main session:
- Launch each agent for ONE task at a time and name the task ID in its brief.
- After an approval, tick the box in `docs/task-list.md`.
- If a test fails, send the same task back to the same agent. Fix it before anything else is built. The 15% reserve pays for reruns.
- Never skip a gate to save time.

## Waves
| Wave | Agents | Schedule |
| --- | --- | --- |
| 0 | project-setup-agent | first days of week 1 |
| 1 | game-logic-agent, world-map-agent, game-control-agent | weeks 1 and 2 |
| 2 | collision-terrain-agent, round-manager-agent, session-join-agent | weeks 3 and 4 |
| 3 | multiplayer-sync-agent, wrecker-ai-agent, auxiliaries-ai-agent | weeks 5 and 6 (slice playtest at the end of week 6) |
| 4 | deployment-agent, ui-agent, graphics-agent | weeks 7 and 8 |
| 5 | audio-agent, effects-agent, security-agent | weeks 9 and 10 |
| 6 | playtest-agent, balance-agent, load-test-agent | weeks 11 and 12 |

After Wave 3, run a playable slice (one map, two teams, networking, and one Wrecker) on a local server and playtest it before Waves 4 to 6 begin.

## Look and feel (user decision, 2026-10-21)
The game must look smooth and polished and never blocky or pixelated. Tank controls are tank-style: W/S drive forward and backward, A/D rotate, with eased acceleration (GC-10, GC-11). Graphics, Effects, Game Control and UI agents run on stronger models, and the tank and terrain art plus terrain animation (GR-1, GR-2, GR-6 to GR-8, EF-3 to EF-6) are pulled forward ahead of the Wave 3 slice playtest. See `docs/task-list.md`.

## Art quality loop (Generator → Evaluator → Refiner)
Before an art, effects or UI task (Graphics, Effects, UI agents) goes to the user's gate, the main session runs this loop. The user's `approved <task ID>` is still required afterward.
1. **Generate:** the task's agent builds it as usual, and its brief says to follow `docs/art-rubric.md`.
2. **Evaluate:** launch `art-evaluator` for that task ID and round number. It writes `handoffs/eval-<task-id>-round-<n>.md` ending in `VERDICT: PASS` or `FAIL` with a fix list.
3. **Refine:** on FAIL, send the fix list to the same task agent (the Refiner), then evaluate again.
4. Stop at PASS, or after 3 rounds. If still FAIL after round 3, show the user the remaining failures with the How to test steps and let them decide.
5. Show the user the final evaluator verdict along with the How to test steps, then STOP for approval.
New user decisions about look or story are added to `docs/art-rubric.md` as new rules.

## Project layout
- `client/`: Angular app hosting the Phaser game
- `server/`: Node.js/Express with Geckos.io (authoritative server)
- `shared/`: TypeScript types used by both, including `game-state.ts` (the game-state sheet) and `tuning.ts` (balance numbers)
- `handoffs/`: one handoff note of 500 words or less per task, plus wave briefs and the integration log
- `docs/`: `GDD.md`, the player state table, deploy notes, bug reports, security findings, load test report, balance notes

## Rules for every agent
- One job per agent. Anything outside it goes in the handoff note for the Lead Agent.
- `shared/game-state.ts` is the shared contract. The Game Logic Agent owns its schema.
- Wrecker and Auxiliary behavior is fixed rule-based code on the server. Do not call a language model from the running game.
- Do not invent rules or numbers. Missing decisions go in the handoff note as open questions.
- If the budget runs short, cut in this order, and only if nothing later depends on it: Effects, Audio, Load Test, Balance tuning, the join queue, then Auxiliary behavior beyond defending the depot.

## Budget (tokens)
| Agent | Model | Tokens/task | Tasks | Budget |
| --- | --- | --- | --- | --- |
| Lead Agent | claude-opus-5-5 | 20,000 | 12 | 240,000 |
| Project Setup Agent | claude-sonnet-5-5 | 20,000 | 4 | 80,000 |
| Game Logic Agent | claude-sonnet-5-5 | 25,000 | 12 | 300,000 |
| World Map Agent | claude-sonnet-5-5 | 22,500 | 8 | 180,000 |
| Game Control Agent | claude-haiku-5-5 | 17,500 | 8 | 140,000 |
| Collision and Terrain Agent | claude-sonnet-5-5 | 22,000 | 10 | 220,000 |
| Round Manager Agent | claude-sonnet-5-5 | 22,000 | 6 | 132,000 |
| Session and Join Agent | claude-sonnet-5-5 | 20,000 | 8 | 160,000 |
| Multiplayer Sync Agent | claude-opus-5-5 | 28,000 | 10 | 280,000 |
| Wrecker AI Agent | claude-sonnet-5-5 | 26,000 | 10 | 260,000 |
| Auxiliaries AI Agent | claude-sonnet-5-5 | 22,000 | 10 | 220,000 |
| Deployment Agent | claude-sonnet-5-5 | 20,000 | 8 | 160,000 |
| UI Agent | claude-haiku-5-5 | 20,000 | 10 | 200,000 |
| Graphics Agent | claude-haiku-5-5 | 20,000 | 10 | 200,000 |
| Audio Agent | claude-haiku-5-5 | 15,000 | 8 | 120,000 |
| Effects Agent | claude-haiku-5-5 | 20,000 | 8 | 160,000 |
| Security Agent | claude-sonnet-5-5 | 20,000 | 4 | 80,000 |
| Playtest Agent | claude-sonnet-5-5 | 20,000 | 16 | 320,000 |
| Balance Agent | claude-sonnet-5-5 | 20,000 | 8 | 160,000 |
| Load Test Agent | claude-sonnet-5-5 | 20,000 | 4 | 80,000 |
| **Total** | | | | **3,692,000** |

Costs assume Anthropic list prices and about 3 input tokens per output token. The budget covers agent work only; your own integration and review time is extra.
