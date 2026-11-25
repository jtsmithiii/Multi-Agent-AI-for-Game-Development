/* eslint-disable @typescript-eslint/no-require-imports */
// One-command deploy (DP-4): `npm run deploy`. No Docker.
//   Local  (no DEPLOY_HOST): build, (re)start under pm2 on this machine, check /health.
//   Remote (DEPLOY_HOST set): build here, copy over ssh/scp, install production deps, restart pm2 there, check /health there.
// Variables are documented in docs/deploy.md. No secrets are stored; ssh uses your key or agent.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
const env = process.env;
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

function fail(msg) {
  console.error(`\nDEPLOY FAILED: ${msg}`);
  process.exit(1);
}
function step(msg) {
  console.log(`\n== ${msg}`);
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: isWin && /\.cmd$/.test(cmd), ...opts });
  if (r.error) fail(`could not run "${cmd}": ${r.error.message}`);
  if (r.status !== 0) fail(`"${cmd} ${args.join(' ')}" exited with code ${r.status}`);
}
function has(cmd, args = ['--version']) {
  const r = spawnSync(cmd, args, { stdio: 'ignore', shell: isWin && /\.cmd$/.test(cmd) });
  return !r.error && r.status === 0;
}
function need(cmd, hint) {
  if (!has(cmd)) fail(`"${cmd}" was not found on PATH. ${hint}`);
}
function nodeMajor() {
  return Number(process.versions.node.split('.')[0]);
}

const port = Number(env.PORT || 3000);
const remoteHost = env.DEPLOY_HOST;

if (nodeMajor() < 20) fail(`Node.js 20 or newer is required (found ${process.versions.node}).`);

// pm2: use a global install when present, otherwise npx (downloads pm2 on first use).
function pm2Cmd() {
  if (has(isWin ? 'pm2.cmd' : 'pm2')) return [isWin ? 'pm2.cmd' : 'pm2'];
  need(isWin ? 'npx.cmd' : 'npx', 'Install Node.js (it ships npx) or run "npm install -g pm2".');
  return [isWin ? 'npx.cmd' : 'npx', '--yes', 'pm2'];
}

function checkHealth(host, p, tries = 30) {
  return new Promise((resolve) => {
    let n = 0;
    const once = () => {
      n += 1;
      const req = http.get({ host, port: p, path: '/health', timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          if (res.statusCode === 200) return resolve({ ok: true, body });
          retry(`HTTP ${res.statusCode}`);
        });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', (e) => retry(e.message));
    };
    const retry = (why) => {
      if (n >= tries) return resolve({ ok: false, body: why });
      setTimeout(once, 1000);
    };
    once();
  });
}

function build() {
  step('Build server and client, copy map data');
  run(npm, ['run', 'build']);
  run(process.execPath, [path.join('deploy', 'copy-assets.cjs')]);
  const entry = path.join(root, 'server', 'dist', 'server', 'src', 'index.js');
  if (!fs.existsSync(entry)) fail(`build finished but ${entry} is missing.`);
}

async function deployLocal() {
  step('Local deploy (no DEPLOY_HOST set)');
  build();
  const pm2 = pm2Cmd();
  step('Start or restart under pm2');
  // Fresh start so changed env values are picked up; harmless if not running.
  spawnSync(pm2[0], [...pm2.slice(1), 'delete', 'tank-battle'], { cwd: root, stdio: 'ignore', shell: isWin && /\.cmd$/.test(pm2[0]) });
  run(pm2[0], [...pm2.slice(1), 'start', path.join('deploy', 'ecosystem.config.cjs')]);
  step(`Check http://localhost:${port}/health`);
  const h = await checkHealth('127.0.0.1', port);
  if (!h.ok) fail(`/health did not answer 200 within 30 s (${h.body}). See deploy/logs/error.log and "pm2 logs tank-battle".`);
  console.log(`/health OK: ${h.body}`);
  console.log('\nDeployed locally. Stop it with: npm run pm2:stop');
}

async function deployRemote() {
  step(`Remote deploy to ${remoteHost}`);
  const user = env.DEPLOY_USER;
  const rpath = env.DEPLOY_PATH;
  const missing = [];
  if (!user) missing.push('DEPLOY_USER');
  if (!rpath) missing.push('DEPLOY_PATH');
  if (missing.length) fail(`DEPLOY_HOST is set, so these are also required: ${missing.join(', ')}.`);
  if (!/^[\w.\-@]+$/.test(remoteHost) || !/^[\w.\-]+$/.test(user)) fail('DEPLOY_HOST / DEPLOY_USER contain unsupported characters.');
  if (!/^[\w./~\-]+$/.test(rpath)) fail('DEPLOY_PATH may only contain letters, digits, ". / ~ _ -" (no spaces).');
  need('ssh', 'Install an OpenSSH client (Windows: Settings > Optional features > OpenSSH Client).');
  need('scp', 'Install an OpenSSH client.');
  need('tar', 'tar ships with Windows 10+ and Linux; install it if missing.');
  const keyArgs = env.DEPLOY_SSH_KEY ? ['-i', env.DEPLOY_SSH_KEY] : [];
  if (env.DEPLOY_SSH_KEY && !fs.existsSync(env.DEPLOY_SSH_KEY)) fail(`DEPLOY_SSH_KEY file not found: ${env.DEPLOY_SSH_KEY}`);
  const sshPort = env.DEPLOY_SSH_PORT || '22';
  if (!/^\d+$/.test(sshPort)) fail('DEPLOY_SSH_PORT must be a number.');
  const target = `${user}@${remoteHost}`;
  const sshOpts = ['-p', sshPort, ...keyArgs, '-o', 'BatchMode=yes'];
  const scpOpts = ['-P', sshPort, ...keyArgs, '-o', 'BatchMode=yes'];

  build();
  step('Pack the release');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tank-battle-'));
  const tarball = path.join(tmp, 'release.tgz');
  const files = ['package.json', 'package-lock.json', 'server/package.json', 'client/package.json', 'server/dist', 'deploy/ecosystem.config.cjs', 'deploy/tank-battle.service']
    .filter((f) => fs.existsSync(path.join(root, f)));
  run('tar', ['-czf', tarball, '-C', root, ...files]);

  step('Copy and install on the remote host');
  run('ssh', [...sshOpts, target, `mkdir -p ${rpath}/deploy/logs`]);
  run('scp', [...scpOpts, tarball, `${target}:${rpath}/release.tgz`]);
  const script = [
    `cd ${rpath}`,
    'tar -xzf release.tgz && rm release.tgz',
    'command -v node >/dev/null || { echo "node is not installed on the remote host"; exit 1; }',
    'npm ci --omit=dev -w server',
    // Settings live in <DEPLOY_PATH>/.env on the host (copy .env.example there); never in the repo.
    '[ -f .env ] && { set -a; . ./.env; set +a; } || echo "note: no .env in the deploy path, using defaults"',
    'PM2="$(command -v pm2 || echo "npx --yes pm2")"',
    '$PM2 delete tank-battle >/dev/null 2>&1 || true',
    '$PM2 start deploy/ecosystem.config.cjs',
    '$PM2 save',
  ].join(' && ');
  run('ssh', [...sshOpts, target, script]);

  step('Check /health on the remote host');
  const h = await checkHealth(remoteHost, port);
  if (!h.ok) {
    fail(`/health on ${remoteHost}:${port} did not answer (${h.body}). The server may be running but TCP ${port} blocked by a firewall; try: ssh ${target} curl -s localhost:${port}/health`);
  }
  console.log(`/health OK: ${h.body}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nDeployed to ${target}:${rpath}.`);
}

(remoteHost ? deployRemote() : deployLocal()).catch((e) => fail(e.message));
