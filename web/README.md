# Local phone viewer

Usage: [English](../README.md) | [한국어](../docs/README.ko.md)

Open http://localhost:8765 in a recent Chrome or Edge. Keep the Android phone connected by USB with USB debugging authorized.

Run `start-web.cmd` from the parent folder to start the server. Closing its terminal stops it. The initial background instance writes logs to `web/server.stdout.log` and `web/server.stderr.log`, with its Node process ID in `web/server.pid`.

The page displays only the live phone screen, preserving its aspect ratio. Audio and phone control are not included. The server binds to 127.0.0.1 only and accepts WebSocket connections from its own localhost origin. One encoder is shared by all local viewer tabs. USB disconnection is retried automatically; encoding stops after the last viewer closes. Use the browser's own fullscreen shortcut if desired.

Requires Node.js and the locally installed `ws` dependency (`npm install` inside `web` if missing). The bundled scrcpy-server is pinned to 5.0.1, including its session/frame packet protocol. Keep the existing `scrcpy-win64-v5.0.1` folder next to this directory.

Protocol source: https://github.com/Genymobile/scrcpy/blob/v5.0.1/server/src/main/java/com/genymobile/scrcpy/device/Streamer.java
