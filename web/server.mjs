import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const root = path.dirname(fileURLToPath(import.meta.url));
const adb = path.resolve(root, '../scrcpy-win64-v5.0.1/adb.exe');
const serverJar = path.resolve(root, '../scrcpy-win64-v5.0.1/scrcpy-server');
const port = Number(process.env.PORT || 8765);
const execute = promisify(execFile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const clients = new Set();
const status = { state: 'waiting', model: '', width: 0, height: 0, packets: 0, lastFrame: null, message: '화면에 연결하는 중이에요.' };
let active = null;
let running = false;
let quitting = false;
let idleTimer;
let sessionPacket = null;
let configPacket = null;
let gop = [];
let gopBytes = 0;

async function adbRun(args) {
  const { stdout } = await execute(adb, args, { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
  return stdout.trim();
}
function sendState() {
  const message = JSON.stringify({ type: 'status', ...status });
  for (const client of clients) if (client.readyState === WebSocket.OPEN) client.send(message);
}
function setState(state, message) { Object.assign(status, { state, message }); sendState(); }
function broadcast(packet) {
  for (const client of clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    // A stalled tab reconnects instead of retaining seconds of old video.
    if (client.bufferedAmount > 2 * 1024 * 1024) { client.close(1013, 'Reconnect for live video'); continue; }
    client.send(packet, { binary: true });
  }
}
function packetReceived(packet) {
  if (packet[0] & 0x80) {
    sessionPacket = Buffer.from(packet);
    configPacket = null; gop = []; gopBytes = 0;
    status.width = packet.readUInt32BE(4); status.height = packet.readUInt32BE(8);
    broadcast(packet);
    setState('streaming', '폰 화면이 연결됐어요.');
    return;
  }
  if (packet[0] & 0x40) {
    configPacket = Buffer.from(packet);
    gop = []; gopBytes = 0;
  } else {
    status.packets++; status.lastFrame = Date.now();
    if (packet[0] & 0x20) { gop = []; gopBytes = 0; }
    if ((packet[0] & 0x20) || gop.length) {
      gop.push(Buffer.from(packet)); gopBytes += packet.length;
      if (gopBytes > 8 * 1024 * 1024) { gop = []; gopBytes = 0; }
    }
  }
  broadcast(packet);
}

async function connectVideo(forwardPort, child) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline && clients.size && !quitting) {
    if (child.exitCode !== null) throw new Error('폰의 화면 전송이 종료됐어요.');
    try {
      return await new Promise((resolve, reject) => {
        const socket = net.connect({ host: '127.0.0.1', port: forwardPort });
        socket.setTimeout(2000);
        const fail = () => { socket.destroy(); reject(new Error('Screen socket not ready')); };
        socket.once('error', fail); socket.once('close', fail); socket.once('timeout', fail);
        socket.once('data', data => {
          socket.off('error', fail); socket.off('close', fail); socket.off('timeout', fail);
          socket.setTimeout(0);
          socket.pause();
          resolve({ socket, firstData: data });
        });
      });
    } catch { await pause(200); }
  }
  throw new Error('USB 연결과 폰의 디버깅 허용을 확인해 주세요.');
}

async function mirrorOnce() {
  const devices = await adbRun(['devices', '-l']);
  const connected = devices.split(/\r?\n/).filter(line => /^\S+\s+device\s/.test(line) && !line.split(/\s/)[0].includes(':'));
  const chosen = process.env.ANDROID_SERIAL
    ? connected.find(line => line.startsWith(`${process.env.ANDROID_SERIAL} `) || line.startsWith(`${process.env.ANDROID_SERIAL}\t`))
    : connected.length === 1 ? connected[0] : null;
  if (!chosen) throw new Error(connected.length > 1 ? 'USB 폰을 한 대만 연결해 주세요.' : 'USB 연결과 폰의 디버깅 허용을 확인해 주세요.');
  const serial = chosen.split(/\s/)[0];
  status.model = (/model:(\S+)/.exec(chosen)?.[1] || 'Android').replaceAll('_', '-');
  const scid = (randomBytes(4).readUInt32BE() & 0x7fffffff).toString(16).padStart(8, '0');
  const remote = `/data/local/tmp/scrcpy-web-${scid}.jar`;
  let forwardPort;
  let child;
  let socket;
  try {
    setState('connecting', '폰 화면을 불러오는 중이에요.');
    await adbRun(['-s', serial, 'push', serverJar, remote]);
    if (!clients.size || quitting) return;
    forwardPort = Number(await adbRun(['-s', serial, 'forward', 'tcp:0', `localabstract:scrcpy_${scid}`]));
    if (!Number.isInteger(forwardPort) || !forwardPort) throw new Error('ADB 화면 연결을 열지 못했어요.');
    child = spawn(adb, ['-s', serial, 'shell', `CLASSPATH=${remote}`, 'app_process', '/', 'com.genymobile.scrcpy.Server', '5.0.1',
      `scid=${scid}`, 'log_level=info', 'tunnel_forward=true', 'audio=false', 'control=false',
      'send_device_meta=false', 'send_dummy_byte=true', 'send_stream_meta=true', 'send_frame_meta=true',
      'max_size=1600', 'max_fps=30', 'video_bit_rate=5000000', 'video_codec=h264', 'video_codec_options=i-frame-interval=1',
      'cleanup=true', 'power_on=false'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => console.log('[phone]', data.toString().trim()));
    child.stderr.on('data', data => console.error('[phone]', data.toString().trim()));
    child.on('error', error => console.error('[phone]', error.message));
    active = { child, socket: null };
    const connection = await connectVideo(forwardPort, child);
    socket = connection.socket;
    active.socket = socket;
    let buffer = Buffer.alloc(0);
    let headerPending = true;
    const consume = data => {
      buffer = Buffer.concat([buffer, data]);
      if (headerPending) {
        if (buffer.length < 5) return;
        if (buffer[0] !== 0 || buffer.toString('ascii', 1, 5) !== 'h264') throw new Error('지원하지 않는 화면 형식이에요.');
        buffer = buffer.subarray(5); headerPending = false;
      }
      while (buffer.length >= 12) {
        const size = buffer[0] & 0x80 ? 12 : 12 + buffer.readUInt32BE(8);
        if (size > 16 * 1024 * 1024) throw new Error('잘못된 영상 패킷이에요.');
        if (buffer.length < size) break;
        packetReceived(buffer.subarray(0, size));
        buffer = buffer.subarray(size);
      }
    };
    await new Promise((resolve, reject) => {
      socket.once('close', resolve); socket.once('error', reject);
      socket.on('data', data => { try { consume(data); } catch (error) { reject(error); socket.destroy(); } });
      try { consume(connection.firstData); } catch (error) { reject(error); socket.destroy(); }
      socket.resume();
      if (!clients.size || quitting) socket.destroy();
    });
    if (clients.size && !quitting) throw new Error('폰 연결이 끊겼어요. 다시 연결하는 중이에요.');
  } finally {
    socket?.destroy();
    child?.kill();
    active = null;
    sessionPacket = null; configPacket = null; gop = []; gopBytes = 0;
    if (forwardPort) await adbRun(['-s', serial, 'forward', '--remove', `tcp:${forwardPort}`]).catch(() => {});
    await adbRun(['-s', serial, 'shell', 'rm', '-f', remote]).catch(() => {});
  }
}
async function ensureMirror() {
  if (running || quitting) return;
  running = true;
  try {
    while (clients.size && !quitting) {
      try { await mirrorOnce(); } catch (error) {
        console.error('[mirror]', error.message);
        setState('disconnected', error.message);
      }
      if (clients.size && !quitting) await pause(2500);
    }
  } finally {
    running = false;
    if (!quitting) setState('waiting', '브라우저에서 화면을 열면 연결돼요.');
  }
}

const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
const allowedOrigins = new Set([...allowedHosts].map(host => `http://${host}`));
const files = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/viewer.js', ['viewer.js', 'text/javascript; charset=utf-8']]]);
const server = http.createServer(async (request, response) => {
  if (!allowedHosts.has(request.headers.host)) { response.writeHead(403).end('Localhost only'); return; }
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/api/status') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ...status, viewers: clients.size })); return;
  }
  const file = files.get(pathname);
  if (request.method !== 'GET' || !file) { response.writeHead(404).end('Not found'); return; }
  try { const body = await readFile(path.join(root, file[0])); response.writeHead(200, { 'Content-Type': file[1] }); response.end(body); }
  catch { response.writeHead(500).end('Could not load viewer'); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
server.on('upgrade', (request, socket, head) => {
  if (!allowedHosts.has(request.headers.host) || !allowedOrigins.has(request.headers.origin) || request.url !== '/stream') {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
  }
  wss.handleUpgrade(request, socket, head, client => wss.emit('connection', client));
});
wss.on('connection', client => {
  clearTimeout(idleTimer);
  clients.add(client);
  client.on('error', () => {});
  client.send(JSON.stringify({ type: 'status', ...status }));
  if (sessionPacket) client.send(sessionPacket);
  if (configPacket) client.send(configPacket);
  for (const packet of gop) client.send(packet);
  client.on('close', () => {
    clients.delete(client);
    if (!clients.size) idleTimer = setTimeout(() => { if (!clients.size) { active?.socket?.destroy(); active?.child?.kill(); } }, 5000);
  });
  void ensureMirror();
});
function shutdown() {
  quitting = true;
  clearTimeout(idleTimer);
  for (const client of clients) client.terminate();
  active?.socket?.destroy(); active?.child?.kill();
  server.close(); wss.close();
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Phone viewer ready: http://localhost:${port}`));
