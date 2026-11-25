/* eslint-disable @typescript-eslint/no-require-imports */
// One-time log rotation setup on the host: `node deploy/setup-logrotate.cjs` (needs internet once to
// install the pm2-logrotate module). Rotates deploy/logs/*.log daily or at 10 MB, keeps 14 files, gzips.
// Logs hold server output only; the server never logs secrets.
const { spawnSync } = require('node:child_process');
const isWin = process.platform === 'win32';
const has = spawnSync(isWin ? 'pm2.cmd' : 'pm2', ['--version'], { stdio: 'ignore', shell: isWin });
const pm2 = !has.error && has.status === 0 ? [isWin ? 'pm2.cmd' : 'pm2'] : [isWin ? 'npx.cmd' : 'npx', '--yes', 'pm2'];
const run = (args) => {
  const r = spawnSync(pm2[0], [...pm2.slice(1), ...args], { stdio: 'inherit', shell: isWin });
  if (r.status !== 0) { console.error(`failed: pm2 ${args.join(' ')}`); process.exit(1); }
};
run(['install', 'pm2-logrotate']);
for (const [k, v] of [['max_size', '10M'], ['retain', '14'], ['compress', 'true'], ['rotateInterval', '0 0 * * *']]) {
  run(['set', `pm2-logrotate:${k}`, v]);
}
console.log('pm2-logrotate configured.');
