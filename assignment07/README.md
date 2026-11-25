# Deliverable 1: Playable Link

**Playable Game Link:** https://jtsmithiii.itch.io/tank-battle

# Deliverable 2: Pipeline Source Code & Engine Integration

**Pipeline Repository:** https://drive.google.com/file/d/1GNYacsvIRDQKId_Fj2-k_L3VrHx-eCdz/view?usp=sharing

**Pipeline Run Video Link:** https://drive.google.com/file/d/1y8bXZWwyGru5S9CN_h1Bxti88oa6jwnt/view?usp=sharing

**Integration Breakdown:** `Phaser`

**Automated Flow Description:** Every agent writes straight into the project folder the engine already loads from, against fixed contracts. Nothing is exported, converted or pasted by hand between an agent's output and a running scene.

1. Fixed destinations. The Project Setup Agent scaffolds the Angular and Phaser client, the Node/Geckos.io server and the shared/ types once, including the Splash, Menu and game scenes. After that, each agent writes into its own slot:
   - Graphics, Effects, UI, Audio and Game Control agents write to client/.
   - Rules, round, session, Wrecker and Auxiliary agents write to server/.
   - Balance numbers go into shared/tuning.ts.

2. One shared contract. shared/game-state.ts is the schema both sides compile against. The Game Logic Agent owns it. Server agents produce state in that shape, and the client scenes read the same types. A mismatch fails the TypeScript build, so it is caught before anyone plays.

3. Assets are loaded by convention. Art and audio are saved in the formats and paths the scenes already load, such as sprites, tiles, depots and Cells. Phaser's preload picks them up by key, so a new tank or terrain tile appears in the scene without any code changes or reformatting. Terrain animation and effects hook into the same keys.

4. Tuning is data, not code. Because the Balance Agent edits only tuning.ts, gameplay changes take effect on the next server start. No logic is touched.

5. Gates replace manual cleanup. Each task ends with a handoff note and a test. Backend work is checked by automated tests and the Lead Agent's fit check. Visual and playable work goes through the art evaluator, then I approved <task ID>. If a piece doesn't fit, the same agent is sent back to fix it before the next task starts.

Result: an agent finishes, the file is already where the engine looks, the types already match, and you can run the scene and see it.


# Deliverable 3: Tank Battle PIPELINE AUDIT & COST ANALYSIS (everything below)

Prepared 2026-11-24. Scope: the whole project, from the 2026-10-21 kickoff to the single-player build finished on 2026-11-24.

**How to read the numbers.** Facts are read from files in this repo. Each is tagged with its source. Anything marked **ESTIMATE** is my own extrapolation. The reason is that the token tracker stopped being updated at run #39 (2026-10-21), so the true cost of roughly 90% of the work was never recorded. Section 4 explains how I filled the gap and how wide the error bars are.

---

## 1. Executive summary

| Question | Answer |
| --- | --- |
| Is the product built? | Yes. 327 of 327 task-list boxes are ticked, none are open (`docs/task-list.md`). All 8 waves, the 11 maps, the Wave 5b/7/8 add-ons and the single-player game are done. |
| Did the pipeline work? | Yes, with caveats. Gates, handoffs and the Lead's integration log produced a green codebase: about 2,032 automated tests (shared 226, server 748, client 1,058; `build-progress-and-defaults.md`, 2026-11-21) and clean lint. |
| Did it stay on plan? | No. The plan was 176 tasks and 3.69 M tokens. The project reached 327 ticked items and about 422 handoff notes. |
| Was the budget controlled? | No. At run #39 the project had used 1.61 M tokens (43.6% of budget) for 36 of 176 tasks, about 2.1x the planned tokens per task. The user waived the budget on 2026-10-21, and the tracker was then abandoned. |
| Rough total agent cost | **ESTIMATE: about $75 to $200 at list price (central case about $125), roughly 16 M to 36 M agent tokens.** The plan implied about $14. See section 4. |
| Biggest pipeline risk | The audit trail and the cost trail have decayed. The tracker is stale and the 500-word handoff rule is broken in 46% of notes. Task-list text still carries superseded numbers (7:00 rounds, cap 28). |

---

## 2. What the pipeline is

Source: `CLAUDE.md`, `.claude/agents/*.md`, `LookAndFeelLoop.md`.

- **21 agent definitions.** These are the 20 build agents plus `art-evaluator`. Each has a single job.
- **Orchestration.** The main session launches every agent, because subagents cannot spawn subagents. The Lead Agent runs between waves to write briefs and check that the pieces fit. At most three agents run at once.
- **Gates.**
  - `(you test)` tasks run alone and wait for `approved <ID>`.
  - Backend tasks gate at the wave level (`approved wave <n>`).
- **Art loop.** Generator → `art-evaluator` → Refiner, up to 3 rounds, before the user's gate. Only 3 evaluator reports exist (`eval-GR-2/11/12-round-1.md`), all dry runs. The loop was effectively not used after the early art tasks.
- **Shared contract.** `shared/game-state.ts` is owned by the Game Logic Agent. Balance numbers live in `shared/tuning.ts`.

### Model assignment (actual `model:` in each agent file)

| Model | Agents |
| --- | --- |
| claude-opus-5-5 | lead, multiplayer-sync, graphics, effects, art-evaluator |
| claude-haiku-5-5 | audio |
| claude-sonnet-5-5 | the other 15 agents, including UI and Game Control |

---

## 3. Delivery audit: plan vs actual

### 3.1 Scope growth

| Measure | Plan (CLAUDE.md / task list) | Actual |
| --- | --- | --- |
| Tasks | 176 (the task list's own footer says "190" and excludes the Wave 5b fixes) | 327 ticked checklist items |
| Waves | 0 to 6 | 0 to 6, plus 1b, 3b, 4b, 4c, 5b, **7 (Solo Practice), 8 (ten more maps)**, post-Wave-8 follow-ups, and an unplanned single-player build |
| Timeline | 12 weeks | Wave 0 to Wave 6 approved by 2026-11-06 (about 17 days), then Waves 7 and 8 by 2026-11-16, then the follow-ups |
| Handoff notes | one per task | 422 `.md` files in `handoffs/`: 371 task notes, plus wave briefs, fix briefs and eval reports |
| Integration log | n/a | 1,474 lines, 45 sections, about 30,400 words |
| GDD | n/a | about 5,300 words, edited many times by the Lead on user decisions |

Most growth was user-driven and decided at checkpoints:
- the stronger models for art (2026-10-21)
- the tank-style steering tasks GC-10 and GC-11
- Raiders and escort (Wave 3b)
- Solo Practice (Wave 7)
- the ten other maps (Wave 8)
- Raider squads
- 5:00 rounds with Wrecker waves
- the cap-60 balance work

None of these were costed in the budget table.

### 3.2 Codebase produced (hand-counted, excluding `node_modules`, `dist`, generated art)

| Area | Files | Lines |
| --- | ---: | ---: |
| `client/src` (Angular and Phaser) | 318 | 56,111 |
| `server/src` | 68 | 7,503 |
| `shared/` | 40 | 6,145 |
| `tools/` (headless tests, bots, load tools) | 43 | 5,521 |
| `scripts/` and `deploy/` | 15 | 911 |
| **Total** | **484** | **about 76,200** |

- 232 spec or test files.
- Test code is not split out of the totals above.
- `single_player_game/` is a separate 70 MB folder holding a snapshot copy of client, server and shared plus a 6.5 MB single-file HTML build.

### 3.3 Quality gates: what the record shows

| Gate | Evidence | Verdict |
| --- | --- | --- |
| Build, test, lint after tasks | Reported by agents and re-run by the main session in nearly every tracker note | Good |
| Wave checkpoints | Every wave has a user `approved wave <n>` | Good |
| Lead integration checks | LD-2 to LD-22, about 45 log sections. Real conflicts were found and routed (stale agent text, schema gaps, ownership clashes) | Good |
| Bots and load tests | 22 playtest and 8 load-test notes, plus 7 bug reports (BUG-1 to BUG-7, all fixed) | Good |
| Security | 18 findings, 2 High. SC3-01 was accepted by the user as a known limit | Acceptable |
| Real-game verification | EF-1 passed gallery checks but failed in the live game (explosions culled). This produced the standing lesson "require real-game verification" | Fixed late |

---

## 4. Cost analysis

### 4.1 Prices used

Source: `claude-api` skill model table (cached 2026-11-03). First-party list prices per million tokens (MTok).

| Model | Input | Output | Cache read | Cache write (5 min) |
| --- | ---: | ---: | ---: | ---: |
| Opus 5.5 | $4.00 | $20.00 | $0.20 | 1.25 x input |
| Sonnet 5.5 | $2.00 | $10.00 | $0.10 | 1.25 x input |
| Haiku 5.5 | $0.10 | $0.50 | not listed | 1.25 x input |

- Haiku prices apply to prompts of 100K tokens or less.
- The 1.25x write factor is the general rule in the skill docs, not a per-model figure.
- CLAUDE.md assumes about 3 input tokens per output token. At that ratio the blended list price per MTok is:
  - Opus: (3 × 4 + 20) / 4 = **$8.00**
  - Sonnet: (3 × 2 + 10) / 4 = **$4.00**
  - Haiku: (3 × 0.10 + 0.50) / 4 = **$0.20**

### 4.2 The plan, in dollars

The CLAUDE.md budget is 3,692,000 tokens. The model mix in its table is Lead and Multiplayer Sync on Opus (520 K), the five art, audio, UI and effects agents on Haiku (820 K) and everything else on Sonnet (2,352 K).

| Model | Budgeted tokens | Blended $/MTok | Planned cost |
| --- | ---: | ---: | ---: |
| Opus | 520,000 | 8.00 | $4.16 |
| Sonnet | 2,352,000 | 4.00 | $9.41 |
| Haiku | 820,000 | 0.20 | $0.16 |
| **Total** | **3,692,000** | | **about $13.70** |

CLAUDE.md's table is now out of date in three places:
- Graphics and Effects now run on Opus (user decision 2026-10-21).
- UI Agent and Game Control Agent are Sonnet in the agent files but Haiku in the budget table.
- Game Control is already recorded as Sonnet in the tracker.

### 4.3 What was actually recorded

Source: `docs/token-tracker.md`. The log covers runs #1 to #39, all dated 2026-10-21.

| Agent | Runs | Tokens | Avg per run | Budget per task |
| --- | ---: | ---: | ---: | ---: |
| Project Setup | 5 | 137,598 | 27,520 | 20,000 |
| Lead | 4 | 362,053 | 90,513 | 20,000 |
| Game Logic | 13 | 337,589 | 25,968 | 25,000 |
| World Map | 9 | 360,058 | 40,006 | 22,500 |
| Game Control | 8 | 412,039 | 51,505 | 17,500 |
| **Total** | **39** | **1,609,337** | **41,265** | about 21,000 |

- Recorded use at that point was 1.61 M tokens for 36 of 176 tasks (20% of tasks). That is 43.6% of the budget, about 44.7 K tokens per task against the planned 21 K.
- Overruns concentrate in two kinds of agent. Lead runs were 4.5x their target. Interactive or visual agents (Game Control, World Map) ran 1.8x to 2.9x.
- A pure rules agent (Game Logic) landed on target.
- The tracker's own caveat applies. The `subagent_tokens` figure may or may not include cache-read tokens. If it does, dollar cost is much lower than the uncached blended rates above.

### 4.4 Estimating the unrecorded 90%

I count agent runs from the handoff files. Excluding wave briefs, fix briefs and evaluator reports, there are about **385 runs**. By agent file model, that is about **100 Opus**, **265 Sonnet** and **19 Haiku**. This classification is approximate. Some prefixes, such as `MP-`, are shared across agents.

Tokens per run are the main uncertainty. Three scenarios, anchored on the recorded 26 K to 90 K per-run spread:

| Scenario | Sonnet / Opus / Haiku tokens per run | Total tokens | Uncached blended cost |
| --- | --- | ---: | ---: |
| Low | 35 K / 50 K / 25 K | about 14.8 M | **about $77** |
| **Central** | 55 K / 80 K / 40 K | about 23.4 M | **about $123** |
| High | 90 K / 130 K / 60 K | about 36.1 M | **about $200** |

How the central case works out:
- Sonnet: 265 runs × 55 K = 14.6 M tokens × $4 = about $58
- Opus: 100 runs × 80 K = 8.0 M tokens × $8 = about $64
- Haiku: 19 runs × 40 K = 0.8 M tokens × $0.20 = about $0.15

Interpretation:
- All three scenarios are **5x to 15x the $13.70 plan**. The plan counted 176 tasks at about 21 K, and the project delivered about 385 runs at about 2x to 3x the per-run target.
- Opus is only about a quarter of runs but about half of the dollars. The model-mix lever matters more than anything else.
- If most input tokens were cache reads (at $0.20 or $0.10 per MTok instead of $4 or $2), the real bill could be 40% to 60% lower than the figures above. I cannot tell from this repo.
- Not included:
  - the main orchestration session, which ran across about 35 days and every approval round-trip (the CLAUDE.md budget excludes it by design);
  - the user's own time and local compute.

**Bottom line:** budget about **$75 to $200 for agent work to date** and treat $125 as the working figure. For an exact figure, pull the real total from the Usage and Cost Analytics API or the Console, filtered by date and model. It takes minutes and replaces this entire section's estimate.

### 4.5 Cost by phase (ESTIMATE, shares of the central case)

| Phase | Share | Notes |
| --- | ---: | --- |
| Waves 0 to 2 (core engine) | about 15% | Best recorded data, about 1.6 M tokens by early Wave 2 |
| Wave 3 and 3b (netcode, AI) | about 12% | Opus netcode agent |
| Wave 4 to 4c (UI, art, deploy) | about 20% | Many `(you test)` reworks |
| Wave 5 to 5b (audio, effects, security fixes) | about 12% | |
| Wave 6 (playtest, balance, load test) | about 12% | |
| Wave 7 (Solo Practice) | about 5% | 24 `SP-` notes |
| Wave 8 (ten maps) | about 14% | 46 `MP-` notes, one map per run |
| Post-Wave-8 follow-ups and the single-player build | about 10% | |

### 4.6 Where the money goes

1. **Lead Agent on Opus.** About 32 notes (`LD-` plus `lead-agent-`). Recorded cost was 4.5x target per run, with outputs that are mostly Markdown. Lead work is reading and cross-checking, a sensible job for a cheaper model with Opus kept for hard design calls.
2. **Rework loops.** Many tasks have `*-fix-*` notes, rerun notes or follow-on fixes (about 60 such files). Examples are GC-5 and GC-6 at 59 K and 83 K tokens each, blocked by occupied dev ports. The CLAUDE.md "15% reserve" for reruns was clearly too small.
3. **Visual `(you test)` tasks.** The agent cannot see a browser. Failures show up at the user's gate and cost another full agent run.
4. **Long documents re-read each run.** The integration log is about 30,400 words and the GDD about 5,300. Every Lead run and many fix runs read large parts of both.
5. **Measurement and soak runs.** Load tests, soaks and bot matches also consume real compute and tokens when agents orchestrate them (about 22 PT, 8 LT and 12 BL notes).

---

## 5. Pipeline audit findings

Severity: **High** means it can mislead decisions or break the next change. **Med** means a real inefficiency or inconsistency. **Low** is housekeeping.

| # | Sev | Finding | Evidence | Recommended action |
| --- | --- | --- | --- | --- |
| P1 | High | **The cost ledger stopped at run #39.** Rows cover 2026-10-21 only. About 346 later runs are untracked. The tracker still shows Collision, Round Manager, Session, Multiplayer Sync, Wrecker, Auxiliaries, Deployment, UI, Graphics, Audio, Effects, Security, Playtest, Balance and Load Test at 0 tokens and "0 / N tasks". | `docs/token-tracker.md` | Either retire the tracker and read spend from the Usage and Cost API, or add a one-line note at the top saying it ended at run #39. |
| P2 | High | **The 500-word handoff rule is broken in 171 of 371 task notes (46%).** CLAUDE.md requires one note of 500 words or less per task. Oversized notes slow the Lead and raise cost on every read. | `wc -w` on `handoffs/[A-Z][A-Z]-*.md` | Reissue the limit in agent briefs. Ask the Lead to check word count at each wave close. |
| P3 | Med | **Task-list text still carries superseded numbers.** RM-1 reads "Five rounds of 7:00", PT-4 and BL-5 test "7:00", and RM-3 says "cap of 28". The product now has 5:00 rounds and a cap of 60 (`TUNING.wreckerAliveMax`). The Lead notes some of this as historical, but the checklist is read as the test spec. | `docs/task-list.md` lines 135, 140, 555, 591, 639 | Add "(superseded: see GDD 2.5 and 4.2)" to those lines, or reword them. |
| P4 | Med | **CLAUDE.md is out of sync with reality.** The budget table gives Haiku to UI, Graphics, Effects and Game Control, but the agent files use Sonnet or Opus. The budget total, the wave table and the "15% reserve" no longer describe the project. The cut-order list is superseded by the user's "budget is not a constraint". | `CLAUDE.md` vs `.claude/agents/*.md` | Update the Budget section, or mark it historical. |
| P5 | Med | **Task-list footer is stale.** It says "Total: 190 tasks" but 327 items are ticked. The task-list header also says the footer excludes the Wave 5b fixes. | `docs/task-list.md` line 776 | Update the count or drop the footer. |
| P6 | Med | **Approvals typed before the agent reports.** At least three recorded cases (UI-4, UI-fix-splash-backdrop, EF-fix-terrainfx-shaders). The main session handled it correctly (re-confirm after the report), but it keeps recurring. | `build-progress-and-defaults.md`, 2026-10-23 and 2026-11-06 | Keep the rule: an approval only counts after the handoff exists. |
| P7 | Med | **The Lead has no shell.** Every Lead check records "did NOT run build/test/lint" and relies on the main session's run. It works, but the Lead's "build passes" test line is never first-hand. | Integration log LD-2, LD-4, LD-6, LD-8 | Keep the main-session pre-check as a mandatory step before each Lead check. |
| P8 | Med | **Agents cannot see a browser.** Several visual or live-game failures reached the user (EF-1 explosions culled, a sandbox gated on `netStatus`, the AX-4 lesson). Mitigations were headless tests and the rule "show the result on screen". | Memory notes 2026-10-22, 2026-11-02 | Keep the rule that real-game verification is part of every `(you test)` task. |
| P9 | Med | **The art Generator-Evaluator-Refiner loop exists on paper but was barely used.** Only three dry-run reports exist, none after Wave 4 art. UI, effects and the later map art all went straight to the user. | `handoffs/eval-*.md` (3 files) | Either run the loop on UI and effects tasks, or document that it is optional now. |
| P10 | Low | **Agent files carry stale shared facts.** The Lead fixed this in waves (log items 6.1 to 6.5, 2.22, 2.23), but the "shared facts" line was patched file by file. | Integration log sections 1 to 6 | Move shared facts into one include or file that every agent reads. |
| P11 | Low | **Docs weight.** `docs/` is 369 MB, mostly match logs and generated assets (about 110 K words of Markdown including logs). The folder is not a git repo. | `du -sh docs`, `git` check | Initialise git, add `.gitignore`, and move logs out of `docs/`. |
| P12 | Low | **Single-player build duplicates the code base.** `single_player_game/src` is a snapshot copy of `client/src`, `server/src` and `shared`. Bugs fixed in one copy will not reach the other. | `single_player_build_notes.txt`, steps 2 and 3 | Decide whether it is a fork or should become a build target of the main project. |
| P13 | Low | **Process drift in notes.** The single-player notes file shows duplicated "HTML generated" and "proof screenshots" lines (about 15 repeats). Also log lines reference dates a day ahead (2026-11-25) of the session date. | `single_player_build_notes.txt` | Make the build script log once per build and use the system date. |

### 5.1 What worked well

- **One agent, one job, one ticket.** Ownership clashes were rare and logged. Shared files edited by several agents were serialised on purpose (log items 1b.8, 8.1 to 8.10).
- **The integration log caught the right things.** It found schema gaps, stale agent prompts, contract mismatches and missing tasks before they became bugs. The owed one-line fixes (6.6, 6.7) were all closed.
- **The user kept real control.** Open questions were answered at checkpoints, with defaults. Decisions are recorded in the log and mirrored into the GDD, with the GDD staying canonical.
- **Automated evidence.** Bot matches, soaks and live load runs gave measured numbers (tick under 33.3 ms, 15 snapshots per second, bandwidth within the 30 Mbit/s plan at cap 60) rather than opinions.
- **The single-player build ran gate-free as the user asked.** Nine agent runs, and every stage was logged with start and stop lines. The final checks passed (test-modes 61, test-ui 52 of 52, browser regression pass). The final playtest verdict was PASS with two low cosmetic issues.

---

## 6. Open items (from the files)

1. Two low issues remain in the single-player build: depots are mostly at 0 Cells by round 5, and the NO WINNER screen does not mark the player out. A faint name tag also shows through the round-1 tally card (`single_player_build_notes.txt`).
2. A human playtest at cap 60 has not happened (`build-progress-and-defaults.md`, 2026-11-21).
3. Stale GDD wording remains for the Raider refuel leg (3.3) and Raider modes (4.1). The user declined three optional follow-ups.
4. Not queued or not possible yet:
   - `SC-docs-sweep` and `LT-long-run`, listed without tick marks in the task list, which the counts above did not flag as unticked boxes;
   - hosted HTTPS for the offline client;
   - a hosted deployment, because no host exists (deploy docs are verified locally and over the LAN only);
   - `UI-sw-update-toast` (optional);
   - the loadout picker.
5. Known accepted limit: SC3-01 (destroyed-player lockout by address).

---

## 7. Recommendations

**Cost**
1. Pull the real total from the Console or the Usage and Cost API and replace section 4's estimate. This is the single most valuable step.
2. For any future work, move Lead runs to Sonnet and keep Opus for netcode and hard design decisions. This is the largest likely saving (Opus is about half of the estimated dollars).
3. Cap per-task context. Give agents a short "read these files only" list, and split the 30 K-word integration log into per-wave files.
4. Check prompt caching if agents are launched through an API harness. Cached reads cost 5% of the input price on both Opus and Sonnet ($0.20 vs $4.00, $0.10 vs $2.00), and the project's repeated reads of the same briefs and logs suit it.

**Pipeline**
5. Fix P1 to P5 in one tidy-up pass: tracker, 500-word rule, task-list text, CLAUDE.md budget table and task-list footer.
6. Keep the three process rules that proved themselves: re-confirm approvals after the agent reports, require a real-game check on every `(you test)` task, and run `npm start` plus a join for anything touching startup code.
7. Initialise git and add a `.gitignore` before any further work, so the next fix pass has history.
8. Decide whether `single_player_game/` is a fork or a build target (P12).

---

## 8. Sources

`CLAUDE.md`, `.claude/agents/*.md` (21 files), `docs/task-list.md`, `docs/token-tracker.md`, `docs/bug-reports.md`, `handoffs/integration-log.md` (sections 1 to 45), `handoffs/` (422 `.md` files), `LookAndFeelLoop.md`, `single_player_build_notes.txt`, `single_player_game_notes.txt`, the project memory notes (build progress, 2026-11-21), and the `claude-api` skill price table (cached 2026-11-03). File counts and line counts were measured on 2026-11-24. Everything labelled ESTIMATE is derived from those inputs and is not a billing figure.
