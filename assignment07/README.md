# Tank Battle

Persistent 2D top-down online tank war for up to 20 players. Four color teams raid each other's depots for Energy Cells over five rounds. Design: `docs/GDD.md`. Build rules: `CLAUDE.md`.

Stack: Angular + Phaser (client), Node.js/Express + Geckos.io (server, authoritative), shared TypeScript types.

## Prerequisites
- Node.js 22 or newer (developed on 24) and npm 11.
- Free ports: 4200 (client), 3000 (server), 9208 (Geckos signalling). Geckos also uses a UDP port range for WebRTC data.

## Install
```
npm install
```
npm 11 may print `allow-scripts` warnings about install scripts (esbuild, lmdb, node-datachannel, and others). They are not errors; everything works without approving them.

## Commands (run from the repo root)
| Command | What it does |
| --- | --- |
| `npm start` | Runs everything on this PC (server and client). Prints `Tank Battle is ready. Open http://localhost:4200`. Stop with Ctrl+C. |
| `npm run dev` | Starts the server (`tsx watch`) and the client (`ng serve`) together. Stop with Ctrl+C. |
| `npm run build` | Compiles the server with `tsc`, then builds the client with `ng build`. Output goes to `server/dist` and `client/dist`. |
| `npm test` | Runs shared tests and server tests (Node test runner via `tsx`), then client tests (Vitest via `ng test`). |
| `npm run lint` | Runs ESLint (typescript-eslint) over client, server and shared. |

After `npm start`: client at http://localhost:4200, server health check at http://localhost:3000/health (returns `{ ok, uptimeSeconds, players, round, phase }`). Override ports with the `PORT` and `GECKOS_PORT` environment variables.

## Changing the Geckos port (before uploading to a network)
The Geckos signalling port is 9208 by default. Two numbers must match:
- **Client:** `geckosPort` in `client/src/environments/environment.ts`. Change it, then rebuild the client with `npm run build`; the value is fixed into the built files. `geckosUrl` in the same file is the server host; leave it empty when the client and server share a host.
- **Server:** the `GECKOS_PORT` environment variable (default 9208). For the process manager, it is the `GECKOS_PORT: process.env.GECKOS_PORT || 9208` line in `deploy/ecosystem.config.cjs`.

If they differ, players see "Cannot reach the game server". For a quick test without rebuilding, open the page with `?geckosPort=<1024-65535>` (for example `http://localhost:4200/?geckosPort=9300`); that overrides the client value for that visit only and is not remembered.

## Layout
- `client/`: Angular app hosting the Phaser game
- `server/`: Node.js/Express with Geckos.io
- `shared/`: types and config used by both (`game-state.ts`, `tuning.ts`), with tests in `shared/test/`
- `handoffs/`: agent handoff notes
- `docs/`: design document and other docs
