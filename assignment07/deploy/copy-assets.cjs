/* eslint-disable @typescript-eslint/no-require-imports */
// Copies the data files the built server reads at run time into server/dist (tsc does not copy .json it cannot see).
// The server looks for ../../../shared/maps/classic.json relative to server/dist/server/src/net, i.e. server/dist/shared/maps.
// MP-13: every top-level shared/maps/*.json is copied (built maps). Fixtures and tools/map-author/out are not.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const from = path.join(root, 'shared', 'maps');
const to = path.join(root, 'server', 'dist', 'shared', 'maps');
fs.mkdirSync(to, { recursive: true });
let n = 0;
for (const e of fs.readdirSync(from, { withFileTypes: true })) {
  if (!e.isFile() || !e.name.endsWith('.json')) continue;
  fs.copyFileSync(path.join(from, e.name), path.join(to, e.name));
  n++;
}
console.log(`copied ${n} map file(s) ${from} -> ${to}`);
