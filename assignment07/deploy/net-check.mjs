// Network check for Tank Battle (DP-3). Plain Node, no game code. Run from the repo root.
//
//   node deploy/net-check.mjs serve            Bare Geckos server + a test web page. Open http://<LAN-IP>:9319 on the other
//                                              device (Chrome or Firefox). It sends messages of 1, 8, 16, 20, 32 and 64 KB, both
//                                              reliable and unreliable, and the page shows which arrived.
//   node deploy/net-check.mjs client <host>    Same check from Node (node-datachannel as WebRTC), for a machine with no browser.
//   node deploy/net-check.mjs game <host> [signallingPort]
//                                              Joins a RUNNING game server (npm run dev or pm2) and counts snapshots for 5 s.
//
// Env: NC_PORT (Geckos signalling, default 9318), NC_HTTP (test page, default 9319),
//      GECKOS_UDP_MIN / GECKOS_UDP_MAX (UDP range, same meaning as .env.example).
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SIZES = [1000, 8000, 16000, 20000, 32000, 64000];
const MODES = ['reliable', 'unreliable'];
const NC_PORT = Number(process.env.NC_PORT ?? 9318);
const NC_HTTP = Number(process.env.NC_HTTP ?? 9319);
const [, , mode = 'help', ...rest] = process.argv;

/** A JSON message whose serialised size is close to `size` bytes. */
const payload = (size, kind) => ({ size, kind, pad: 'x'.repeat(Math.max(0, size - 40)) });
const key = (kind, size) => `${kind}-${size}`;

function report(received) {
  const lines = [];
  for (const kind of MODES) for (const size of SIZES) lines.push(`${kind.padEnd(10)} ${String(size).padStart(6)} bytes  ${received.has(key(kind, size)) ? 'ARRIVED' : 'MISSING'}`);
  return lines.join('\n');
}

async function serve() {
  const { default: geckos } = await import('@geckos.io/server');
  const esbuild = require('esbuild');
  const udp = process.env.GECKOS_UDP_MIN && process.env.GECKOS_UDP_MAX
    ? { portRange: { min: Number(process.env.GECKOS_UDP_MIN), max: Number(process.env.GECKOS_UDP_MAX) } } : {};
  const io = geckos({ cors: { origin: '*' }, ...udp });
  const bundle = await esbuild.build({
    stdin: { contents: "import { geckos } from '@geckos.io/client'; window.geckos = geckos;", resolveDir: process.cwd(), loader: 'js' },
    bundle: true, write: false, format: 'iife', platform: 'browser',
  });
  const page = `<!doctype html><meta charset=utf-8><title>Tank Battle net check</title>
<body style="font:16px monospace"><h3>Tank Battle net check</h3><pre id=out>connecting...</pre>
<script>${bundle.outputFiles[0].text}</script>
<script>
const SIZES=${JSON.stringify(SIZES)}, MODES=${JSON.stringify(MODES)}, got=new Set(), out=document.getElementById('out');
const ch=geckos({url:location.protocol+'//'+location.hostname, port:${NC_PORT}});
const show=(s)=>{out.textContent=s};
ch.onConnect((err)=>{ if(err){show('CONNECT FAILED: '+err.message);return}
  show('connected, waiting for messages (4 s)...');
  ch.on('chk',(d)=>{got.add(d.kind+'-'+d.size)});
  ch.emit('ready',{},{reliable:true});
  setTimeout(()=>{ const NL=String.fromCharCode(10); let t=navigator.userAgent+NL+NL;
    for(const k of MODES)for(const s of SIZES)t+=k.padEnd(10)+' '+String(s).padStart(6)+' bytes  '+(got.has(k+'-'+s)?'ARRIVED':'MISSING')+NL;
    show(t); ch.emit('result',{ua:navigator.userAgent,got:[...got]},{reliable:true}); },4000);
});
</script>`;
  const web = http.createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end(page); });
  io.onConnection((channel) => {
    console.log(`[net-check] ${channel.id} connected`);
    channel.on('ready', () => {
      for (const kind of MODES) for (const size of SIZES) {
        try { channel.emit('chk', payload(size, kind), kind === 'reliable' ? { reliable: true } : undefined); } catch (e) { console.log(`send ${kind} ${size} failed: ${e.message}`); }
      }
    });
    channel.on('result', (d) => {
      console.log(`[net-check] result from ${d.ua}`);
      console.log(report(new Set(d.got)));
    });
  });
  web.listen(NC_HTTP, () => console.log(`[net-check] test page on http://<this-machine-LAN-IP>:${NC_HTTP}  (signalling ${NC_PORT}${udp.portRange ? `, UDP ${udp.portRange.min}-${udp.portRange.max}` : ''})`));
  io.listen(NC_PORT);
}

async function connect(host, port) {
  const poly = await import('node-datachannel/polyfill');
  for (const name of ['RTCPeerConnection', 'RTCSessionDescription', 'RTCIceCandidate']) globalThis[name] ??= poly[name];
  const { geckos } = await import('@geckos.io/client');
  const channel = geckos({ url: host.startsWith('http') ? host : `http://${host}`, port });
  return new Promise((resolve, reject) => channel.onConnect((err) => (err ? reject(err) : resolve(channel))));
}

async function client(host) {
  const channel = await connect(host, NC_PORT);
  const got = new Set();
  channel.on('chk', (d) => got.add(key(d.kind, d.size)));
  channel.emit('ready', {}, { reliable: true });
  await new Promise((r) => setTimeout(r, 4000));
  console.log(report(got));
  channel.close();
  process.exit(0);
}

async function game(host, port) {
  const channel = await connect(host, port);
  const seen = { snapshot: 0, bytes: 0, maxBytes: 0, reply: null };
  channel.on('join-reply', (d) => { seen.reply = d; });
  channel.on('snapshot', (d) => { const n = JSON.stringify(d).length; seen.snapshot += 1; seen.bytes += n; seen.maxBytes = Math.max(seen.maxBytes, n); });
  channel.emit('join', { type: 'join', name: 'netcheck', color: 'blue' }, { reliable: true });
  await new Promise((r) => setTimeout(r, 5000));
  console.log(`join-reply: ${JSON.stringify(seen.reply)}`);
  console.log(`snapshots in 5 s: ${seen.snapshot} (about ${(seen.snapshot / 5).toFixed(1)}/s), average ${seen.snapshot ? Math.round(seen.bytes / seen.snapshot) : 0} bytes, largest ${seen.maxBytes} bytes`);
  channel.close();
  process.exit(seen.snapshot > 0 ? 0 : 1);
}

process.on('unhandledRejection', (e) => { console.error(`FAILED: ${e?.message ?? e}`); process.exit(1); });
if (mode === 'serve') await serve();
else if (mode === 'client' && rest[0]) await client(rest[0]);
else if (mode === 'game' && rest[0]) await game(rest[0], Number(rest[1] ?? 9208));
else console.log('usage: node deploy/net-check.mjs serve | client <host> | game <host> [signallingPort]');
