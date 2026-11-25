/* eslint-disable @typescript-eslint/no-require-imports */
// MP-13 check: the production layout holds every map the catalog says is built, and the server starts with them all.
//   node deploy/check-maps.cjs            files check, then start the built server on its own ports and compare
//   node deploy/check-maps.cjs --files    files check only (runs at the end of npm run deploy:prepare)
//   node deploy/check-maps.cjs --selftest simulate a missing map file and show the check fails (exit 0 when it does)
// The server logs each map's name (the JSON `name`, lower-case id today); compared case-insensitively to the catalog name.
// Reads the built catalog (server/dist/shared/map/catalog.js), so a new built map needs no change here.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const srcMaps = path.join(root, 'shared', 'maps');
const distMaps = path.join(root, 'server', 'dist', 'shared', 'maps');
const catalogJs = path.join(root, 'server', 'dist', 'shared', 'map', 'catalog.js');
const serverJs = path.join(root, 'server', 'dist', 'server', 'src', 'index.js');

/** Top-level shared/maps/*.json (not fixtures, not tools/map-author/out). */
function sourceMapFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name);
}

/** Pure file check. Returns a list of problems (empty means OK). */
function checkFiles(srcDir, distDir, builtIds) {
  const errors = [];
  const want = new Set(sourceMapFiles(srcDir));
  for (const id of builtIds) {
    if (!want.has(`${id}.json`)) errors.push(`catalog says "${id}" is built but shared/maps/${id}.json does not exist`);
  }
  for (const file of want) {
    const dest = path.join(distDir, file);
    if (!fs.existsSync(dest)) {
      errors.push(`map file missing from the production layout: ${dest} (run npm run deploy:prepare)`);
      continue;
    }
    if (fs.readFileSync(dest, 'utf8') !== fs.readFileSync(path.join(srcDir, file), 'utf8')) {
      errors.push(`map file differs from shared/maps/${file}: ${dest} (stale build, run npm run deploy:prepare)`);
    }
  }
  return errors;
}

function builtCatalog() {
  if (!fs.existsSync(catalogJs)) throw new Error(`built catalog not found: ${catalogJs} (run npm run deploy:prepare)`);
  let cat;
  try { cat = require(catalogJs); } catch (e) {
    throw new Error(`the built catalog cannot load (a map JSON it imports is missing from server/dist/shared/maps; tsc does not copy it, run npm run deploy:prepare): ${String(e.message).split(/\r?\n/)[0]}`);
  }
  const built = cat.MAP_CATALOG.filter((e) => e.status === 'built');
  const missingData = built.filter((e) => !cat.BUILT_MAP_FILES[e.id]).map((e) => e.id);
  return { built, missingData };
}

function startServerAndReadMaps(expectedNames) {
  const port = process.env.CHECK_PORT ?? '3901';
  const geckos = process.env.CHECK_GECKOS_PORT ?? '10096';
  const env = {
    ...process.env, NODE_ENV: 'production', PORT: port, GECKOS_PORT: geckos, HOST: 'localhost',
    GECKOS_UDP_MIN: process.env.CHECK_UDP_MIN ?? '12201', GECKOS_UDP_MAX: process.env.CHECK_UDP_MAX ?? '12300',
  };
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [serverJs], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    let done = false;
    const finish = (errors, line) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      resolve({ errors, line });
    };
    const timer = setTimeout(() => finish(['server did not print "[server] maps:" within 20 s'], ''), 20000);
    const onData = (d) => {
      buf += d.toString();
      const m = /\[server\] maps: (.*)/.exec(buf);
      if (!m) return;
      const got = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      const errors = expectedNames.filter((n) => !got.map((g) => g.toLowerCase()).includes(n.toLowerCase())).map((n) => `server started without built map "${n}" (it loaded: ${got.join(', ')})`);
      finish(errors, m[0]);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => finish([`server exited early with code ${code}: ${buf.slice(-300)}`], ''));
  });
}

function selftest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-check-maps-'));
  try {
    const src = path.join(tmp, 'src');
    const dist = path.join(tmp, 'dist');
    fs.mkdirSync(src);
    fs.mkdirSync(dist);
    for (const id of ['classic', 'cross']) {
      fs.writeFileSync(path.join(src, `${id}.json`), '{}');
      fs.writeFileSync(path.join(dist, `${id}.json`), '{}');
    }
    const ok = checkFiles(src, dist, ['classic', 'cross']);
    fs.rmSync(path.join(dist, 'cross.json'));
    const missing = checkFiles(src, dist, ['classic', 'cross']);
    fs.rmSync(path.join(src, 'cross.json'));
    const noSource = checkFiles(src, dist, ['classic', 'cross']);
    if (ok.length !== 0 || missing.length !== 1 || !/missing from the production layout.*cross\.json/.test(missing[0]) || noSource.length !== 1) {
      console.error('selftest FAILED', { ok, missing, noSource });
      process.exit(1);
    }
    console.log('selftest OK. A missing map reports:\n  ' + missing[0]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--selftest') return selftest();
  const { built, missingData } = builtCatalog();
  const errors = checkFiles(srcMaps, distMaps, built.map((e) => e.id));
  for (const id of missingData) errors.push(`catalog says "${id}" is built but BUILT_MAP_FILES has no data for it`);
  let line = '';
  if (arg !== '--files' && errors.length === 0) {
    const res = await startServerAndReadMaps(built.map((e) => e.name));
    errors.push(...res.errors);
    line = res.line;
  }
  if (errors.length) {
    console.error('MAP CHECK FAILED:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log(`maps OK: ${built.length} built (${built.map((e) => e.id).join(', ')})${line ? `; server printed "${line}"` : ''}`);
}

main().catch((e) => { console.error('MAP CHECK FAILED:', e.message); process.exit(1); });
