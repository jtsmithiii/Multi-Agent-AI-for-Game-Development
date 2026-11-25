/* eslint-disable @typescript-eslint/no-require-imports */
// `npm start`: run server + client together on this machine (no env vars, no pm2). Ctrl+C stops both.
const net = require('node:net');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');

const PORTS = [[3000, 'server (PORT)'], [9208, 'Geckos signalling (GECKOS_PORT)'], [4200, 'client']];
const URL = 'http://localhost:4200';

function busy(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => s.close(() => resolve(false)));
    s.listen(port);
  });
}
const up = (u) => new Promise((r) => http.get(u, (res) => { res.resume(); r(res.statusCode === 200); }).on('error', () => r(false)));

(async () => {
  const taken = [];
  for (const [p, n] of PORTS) if (await busy(p)) taken.push(`${p} (${n})`);
  if (taken.length) {
    console.error(`\nCannot start: port ${taken.join(', ')} is already in use.\nClose the other Tank Battle window (Ctrl+C), or an old server, and try again.\n`);
    process.exit(1);
  }
  // No shell (avoids Node DEP0190): run npm's own script with this Node. npm_execpath is set when started via `npm start`.
  const npmCli = process.env.npm_execpath;
  const localEnv = { ...process.env, HOST: process.env.HOST || 'localhost' }; // loopback only: no SC1-05 warning for plain npm start
  const child = npmCli && /\.c?js$/.test(npmCli)
    ? spawn(process.execPath, [npmCli, 'run', 'dev'], { stdio: 'inherit', env: localEnv })
    : spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { stdio: 'inherit', shell: process.platform === 'win32', env: localEnv });
  const stop = () => {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGINT');
    } catch { /* already gone */ }
  };
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
  child.on('exit', (code) => process.exit(code ?? 0));
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if ((await up('http://localhost:3000/health')) && (await up(URL))) {
      console.log(`\n=====  Tank Battle is ready. Open ${URL}  (Ctrl+C here stops everything)  =====\n`);
      return;
    }
  }
  console.error('\nNot ready after 3 minutes. Read the red or blue lines above for the error.');
})();
