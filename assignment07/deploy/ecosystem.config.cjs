/* eslint-disable @typescript-eslint/no-require-imports */
// pm2 process file for the Tank Battle server (DP-1). No Docker.
// Run from the repo root after `npm run build`:
//   npx pm2 start deploy/ecosystem.config.cjs
//   npx pm2 stop tank-battle      (or: npx pm2 delete tank-battle)
// Settings come from the environment (see .env.example); defaults here match server/src/index.ts.
const path = require('node:path');

const root = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'tank-battle',
      cwd: root,
      script: path.join(root, 'server', 'dist', 'server', 'src', 'index.js'),
      instances: 1,          // one authoritative world; never cluster
      exec_mode: 'fork',
      autorestart: true,     // restart after a crash (DP-6: tested by npm run deploy:crash-test)
      restart_delay: 1000,   // wait 1 s between a crash and the next start
      min_uptime: '5s',      // a start that dies within 5 s counts as unstable
      max_restarts: 20,      // after 20 unstable restarts in a row pm2 stops retrying (no endless spin)
      kill_timeout: 3000,    // a stop gets 3 s to finish before SIGKILL
      max_memory_restart: '500M',
      time: true,
      merge_logs: true,
      out_file: path.join(root, 'deploy', 'logs', 'out.log'),
      error_file: path.join(root, 'deploy', 'logs', 'error.log'),
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        GECKOS_PORT: process.env.GECKOS_PORT || 9208,
        // Optional settings, passed through only when set (see .env.example).
        ...Object.fromEntries(
          ['GECKOS_UDP_MIN', 'GECKOS_UDP_MAX', 'PUBLIC_HOST', 'CLIENT_ORIGIN', 'TURN_URL', 'TURN_USER', 'TURN_SECRET', 'TB_MATCH_SEED', 'TB_NET_STATS']
            .filter((k) => process.env[k]).map((k) => [k, process.env[k]]),
        ),
      },
    },
  ],
};
