/* eslint-disable @typescript-eslint/no-require-imports */
// DP-1 check: load the pm2 config, verify the script exists, report problems. Exit 1 on error.
const fs = require('node:fs');
const cfg = require('./ecosystem.config.cjs');
const errors = [];
if (!Array.isArray(cfg.apps) || cfg.apps.length !== 1) errors.push('expected exactly one app');
for (const app of cfg.apps ?? []) {
  if (!app.name) errors.push('app has no name');
  if (!fs.existsSync(app.script)) errors.push(`script not found: ${app.script} (run npm run build)`);
  if (app.instances !== 1) errors.push('instances must be 1');
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('pm2 config OK:', cfg.apps[0].script);
