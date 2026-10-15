const canvas = document.querySelector('#canvas');
const context = canvas.getContext('2d', { alpha: false });
let socket;
let decoder;
let config;
let readyForDelta = false;
let pendingFrame;
let animationPending = false;
let retryTimer;
let generation = 0;

function resetDecoder() {
  if (decoder && decoder.state !== 'closed') decoder.close();
  decoder = null; readyForDelta = false;
  pendingFrame?.close(); pendingFrame = null;
}
function draw(frame) {
  pendingFrame?.close(); pendingFrame = frame;
  if (animationPending) return;
  animationPending = true;
  requestAnimationFrame(() => {
    animationPending = false;
    const latest = pendingFrame; pendingFrame = null;
    if (!latest) return;
    try {
      if (canvas.width !== latest.displayWidth || canvas.height !== latest.displayHeight) {
        canvas.width = latest.displayWidth; canvas.height = latest.displayHeight;
      }
      context.drawImage(latest, 0, 0, canvas.width, canvas.height);
    } finally { latest.close(); }
  });
}
function codecFromSps(bytes) {
  for (let i = 0; i < bytes.length - 7; i++) {
    if (bytes[i] !== 0 || bytes[i + 1] !== 0) continue;
    const start = bytes[i + 2] === 1 ? i + 3 : bytes[i + 2] === 0 && bytes[i + 3] === 1 ? i + 4 : -1;
    if (start >= 0 && (bytes[start] & 31) === 7) {
      return 'avc1.' + Array.from(bytes.subarray(start + 1, start + 4), value => value.toString(16).padStart(2, '0')).join('');
    }
  }
  throw new Error('Invalid H.264 configuration');
}
function configure(bytes) {
  resetDecoder(); config = bytes.slice();
  decoder = new VideoDecoder({ output: draw, error: fail });
  decoder.configure({ codec: codecFromSps(config), optimizeForLatency: true, hardwareAcceleration: 'prefer-hardware' });
}
function fail(error) { console.error(error); socket?.close(); }
function receive(packet) {
  const view = new DataView(packet);
  if (view.byteLength < 12) throw new Error('Incomplete video packet');
  const flags = view.getUint8(0);
  if (flags & 0x80) { resetDecoder(); config = null; return; }
  const data = new Uint8Array(packet, 12);
  if (flags & 0x40) { configure(data); return; }
  if (!decoder || decoder.state !== 'configured') return;
  const key = Boolean(flags & 0x20);
  if (!key && !readyForDelta) return;
  if (decoder.decodeQueueSize > 5) {
    if (config) configure(config);
    if (!key) return;
  }
  let payload = data;
  if (key && config) {
    payload = new Uint8Array(config.length + data.length);
    payload.set(config); payload.set(data, config.length);
  }
  const timestamp = Number(view.getBigUint64(0) & ((1n << 61n) - 1n));
  decoder.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp, data: payload }));
  readyForDelta = true;
}
function connect() {
  clearTimeout(retryTimer);
  const current = ++generation;
  socket?.close(); resetDecoder(); config = null;
  socket = new WebSocket('ws://' + location.host + '/stream');
  socket.binaryType = 'arraybuffer';
  socket.onmessage = event => {
    if (current !== generation) return;
    try {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data);
        if (message.state !== 'streaming') {
          resetDecoder(); config = null;
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      } else receive(event.data);
    } catch (error) { fail(error); }
  };
  socket.onclose = () => {
    if (current !== generation) return;
    resetDecoder();
    context.clearRect(0, 0, canvas.width, canvas.height);
    retryTimer = setTimeout(connect, 2000);
  };
  socket.onerror = () => { if (current === generation) socket.close(); };
}
addEventListener('pagehide', () => { generation++; clearTimeout(retryTimer); socket?.close(); resetDecoder(); });
if ('VideoDecoder' in window) connect();
else console.error('This viewer requires a recent Chrome or Edge browser.');
