/* eslint-disable @typescript-eslint/no-require-imports */
// DP-7 restart test: `npm run deploy:restart-test` (after `npm run deploy:prepare`).
// Starts the server under pm2 with a fixed TB_MATCH_SEED, does a planned `pm2 restart`, and checks that it
// comes back as a fresh match (round 1, players 0, uptime reset), with the same seed, and that
// deploy/logs/out.log still exists, kept its old content and was appended to. Leaves pm2 stopped (deleted).
const { spawnSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const port = Number(process.env.PORT || 3000);
const NAME = 'tank-battle';
const SEED = process.env.TB_MATCH_SEED || '12345';
process.env.TB_MATCH_SEED = SEED; // the ecosystem file passes it to the server
const outLog = path.join(root, 'deploy', 'logs', 'out.log');

function pm2(args) {
  const has = spawnSync(isWin ? 'pm2.cmd' : 'pm2', ['--version'], { stdio: 'ignore', shell: isWin });
  const cmd = !has.error && has.status === 0 ? [isWin ? 'pm2.cmd' : 'pm2'] : [isWin ? 'npx.cmd' : 'npx', '--yes', 'pm2'];
  return spawnSync(cmd[0], [...cmd.slice(1), ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe', shell: isWin });
}
function getHealth() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 800 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve(res.statusCode === 200 ? JSON.parse(body) : null); } catch { resolve(null); } });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUp(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const h = await getHealth(); if (h) return h; await sleep(200); }
  return null;
}
const seedLines = () => (fs.existsSync(outLog) ? fs.readFileSync(outLog, 'utf8').split('\n').filter((l) => l.includes(`seed ${SEED}`)) : []);
function check(ok, msg) { if (!ok) throw new Error(msg); console.log(`ok: ${msg}`); }

async function main() {
  pm2(['delete', NAME]);
  fs.mkdirSync(path.dirname(outLog), { recursive: true });
  const s = pm2(['start', path.join('deploy', 'ecosystem.config.cjs')]);
  if (s.status !== 0) throw new Error('pm2 start failed (run npm run deploy:prepare first)');
  const first = await waitUp(30000);
  if (!first) throw new Error('/health did not answer within 30 s of starting');
  await sleep(3000);
  const sizeBefore = fs.statSync(outLog).size;
  const seedsBefore = seedLines().length;
  const up1 = (await getHealth()).uptimeSeconds;
  check(seedsBefore >= 1, `log shows the start with seed ${SEED}`);

  pm2(['restart', NAME, '--update-env']);
  // wait for the old process to be gone (uptime resets) and the new one to answer
  let second = null;
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const h = await getHealth();
    if (h && h.uptimeSeconds < up1) { second = h; break; }
    await sleep(200);
  }
  if (!second) throw new Error('server did not come back with a reset uptime within 30 s');
  await sleep(1500);
  check(second.ok === true && second.round === 1 && second.players === 0, `fresh match after restart (round ${second.round}, players ${second.players})`);
  check(second.uptimeSeconds < up1, `uptime reset (${up1} s to ${second.uptimeSeconds} s)`);
  check(fs.existsSync(outLog), 'out.log still exists');
  check(fs.statSync(outLog).size > sizeBefore, 'out.log was appended to, not replaced');
  check(seedLines().length === seedsBefore + 1, `same seed ${SEED} logged again by the new process`);
  console.log('RESTART TEST PASSED');
}
main().then(
  () => { pm2(['delete', NAME]); process.exit(0); },
  (e) => { console.error(`RESTART TEST FAILED: ${e.message}`); pm2(['delete', NAME]); process.exit(1); },
);
