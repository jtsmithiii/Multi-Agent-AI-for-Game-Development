/* eslint-disable @typescript-eslint/no-require-imports */
// DP-6 crash test: `npm run deploy:crash-test` (after `npm run build` / deploy:prepare).
// Starts the server under pm2, confirms /health, kills the server process hard, then measures how long
// until /health answers 200 again. Exits 1 if that takes more than 10 s. Leaves pm2 stopped (deleted).
const { spawnSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const port = Number(process.env.PORT || 3000);
const LIMIT_MS = 10000;
const NAME = 'tank-battle';

function pm2(args, capture = false) {
  const has = spawnSync(isWin ? 'pm2.cmd' : 'pm2', ['--version'], { stdio: 'ignore', shell: isWin });
  const cmd = !has.error && has.status === 0 ? [isWin ? 'pm2.cmd' : 'pm2'] : [isWin ? 'npx.cmd' : 'npx', '--yes', 'pm2'];
  return spawnSync(cmd[0], [...cmd.slice(1), ...args], { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'ignore', shell: isWin });
}
function health() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 800 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function pidOf() {
  const r = pm2(['jlist'], true);
  const m = /\[\s*\{[\s\S]*\}\s*\]|\[\s*\]/.exec(r.stdout || '');
  try {
    const app = JSON.parse(m ? m[0] : '[]').find((a) => a.name === NAME);
    return app && app.pid ? { pid: app.pid, restarts: app.pm2_env.restart_time } : null;
  } catch { return null; }
}
async function waitUp(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await health()) return true; await sleep(200); }
  return false;
}
async function main() {
  pm2(['delete', NAME]);
  const s = pm2(['start', path.join('deploy', 'ecosystem.config.cjs')]);
  if (s.status !== 0) throw new Error('pm2 start failed (run npm run build first)');
  if (!(await waitUp(30000))) throw new Error('/health did not answer within 30 s of starting');
  // Let min_uptime (5 s) pass so the kill counts as a crash of a stable process.
  await sleep(6000);
  const before = pidOf();
  if (!before) throw new Error('could not read the server pid from pm2 jlist');
  console.log(`Server up under pm2, pid ${before.pid}, restarts so far ${before.restarts}. Killing it.`);
  const t0 = Date.now();
  process.kill(before.pid, 'SIGKILL');
  // Wait until the old process is really gone, so an instant 200 from it cannot count.
  let sawDown = false;
  let upAt = null;
  while (Date.now() - t0 < LIMIT_MS + 5000) {
    const ok = await health();
    if (!ok) sawDown = true;
    else if (sawDown) { upAt = Date.now(); break; }
    await sleep(100);
  }
  if (!sawDown) throw new Error('/health never went down after the kill (kill did not work)');
  if (!upAt) throw new Error('/health did not come back within 15 s');
  const ms = upAt - t0;
  const after = pidOf();
  console.log(`/health answered again ${(ms / 1000).toFixed(2)} s after the kill (limit ${LIMIT_MS / 1000} s). New pid ${after && after.pid}, restarts ${after && after.restarts}.`);
  if (!after || after.pid === before.pid) throw new Error('pid did not change, so this was not a restart');
  if (ms > LIMIT_MS) throw new Error(`restart took ${ms} ms, over the ${LIMIT_MS} ms limit`);
  console.log('CRASH TEST PASSED');
}
main().then(
  () => { pm2(['delete', NAME]); process.exit(0); },
  (e) => { console.error(`CRASH TEST FAILED: ${e.message}`); pm2(['delete', NAME]); process.exit(1); },
);
