# scrcpy Web Viewer

[한국어 사용법](docs/README.ko.md)

A minimal local web viewer for an Android phone connected over USB. Open **http://localhost:8765** to see the phone screen, with no buttons, status bars, or other viewer UI.

The phone's H.264 video passes through a local Node.js server to the browser, where WebCodecs decodes it. The viewer captures the phone directly, so covering a desktop scrcpy window does not hide the stream.

## Features

- A screen-only page with the original aspect ratio.
- Up to 30 fps, with the longest edge limited to 1600 pixels.
- Automatic retry after a USB disconnection.
- Multiple viewer tabs sharing one phone stream.
- A server bound to `127.0.0.1`, with no cloud account or hosting required.

Video only: audio, browser-based phone control, and recording are not included. Actual frame rate depends on the phone, screen activity, and browser.

## Requirements

- Windows x64, with Windows PowerShell available.
- [Node.js](https://nodejs.org/) 22 or newer, including npm.
- A recent Chrome or Edge browser with WebCodecs support.
- An Android phone supported by [scrcpy 5.0.1](https://github.com/Genymobile/scrcpy/releases/tag/v5.0.1).
- A USB data cable, USB debugging enabled, and authorization for this computer accepted on the phone.
- Internet access during setup to download scrcpy and the npm dependency.

The setup script and runtime paths currently target Windows x64. Other platforms are not supported by this repository's launchers.

## Quick start

Clone the repository, or download its ZIP from GitHub and extract it:

```powershell
git clone https://github.com/yuudong123/scrcpy-web-viewer.git
cd scrcpy-web-viewer
.\setup.cmd
```

`setup.cmd` downloads the official scrcpy 5.0.1 Windows archive if needed, verifies its pinned SHA-256 before extraction, and installs the locked web dependency with `npm ci`. Existing runtime files are reused. Downloaded binaries and dependencies are kept locally and excluded from Git.

Connect and unlock your phone, enable **USB debugging**, and accept the debugging authorization prompt. Then run:

```powershell
.\start-web.cmd
```

Open **[http://localhost:8765](http://localhost:8765)** in Chrome or Edge. Keep the terminal open while using the viewer; press **Ctrl+C** there to stop the server. Streaming starts when a viewer tab opens and stops about five seconds after the last viewer closes.

The page intentionally has no controls or error overlays. Connection details are available in the server terminal and at [`/api/status`](http://localhost:8765/api/status).

## Options

Use a different port from PowerShell:

```powershell
$env:PORT = '9000'
.\start-web.cmd
```

Then visit `http://localhost:9000`.

If more than one USB phone is connected, select one using its ADB serial:

```powershell
.\scrcpy-win64-v5.0.1\adb.exe devices -l
$env:ANDROID_SERIAL = 'YOUR_DEVICE_SERIAL'
.\start-web.cmd
```

To use the ordinary desktop scrcpy window, run `start-mirroring.cmd`. It selects a single USB device and is independent of the web viewer.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Black screen | Check USB authorization, try a data-capable cable or another USB port, and inspect the server terminal. |
| Phone is missing or unauthorized | Run `.\scrcpy-win64-v5.0.1\adb.exe devices -l`; unlock the phone and accept its debugging prompt. Check the manufacturer's ADB driver if needed. |
| Port is already in use (`EADDRINUSE`) | Stop the existing server or use another `PORT`. |
| Missing runtime files or `ws` | Run `setup.cmd` again. |
| Browser cannot decode video | Use a recent Chrome or Edge and reload the page. |
| USB was disconnected | Reconnect the phone and authorize it if prompted. The viewer retries automatically. |
| Locked or protected content is black | Unlock the phone. Apps with protected content may prevent capture. |

`localhost` works on the computer running this server. The server does not listen on the LAN and cannot be hosted as a static GitHub Pages site, because it needs local ADB access to the USB phone.

## Project layout

```text
README.md                 English usage guide
docs/README.ko.md          Korean usage guide
LICENSE                   MIT license for this project's code
THIRD_PARTY_NOTICES.md     Upstream components and licenses
setup.cmd                 First-time Windows setup
scripts/setup.mjs          Verified scrcpy download and npm installation
start-web.cmd             Web viewer launcher
start-mirroring.cmd       Optional desktop scrcpy launcher
web/server.mjs            Local HTTP/WebSocket server and scrcpy bridge
web/viewer.js             Browser H.264 decoding and rendering
web/index.html            Screen-only page
```

The scrcpy server and its wire protocol are pinned to **5.0.1**. Do not replace the runtime with another version without updating the bridge and setup script together.

## License

This project's original code and documentation are available under the [MIT License](LICENSE). Third-party components retain their own licenses; see [Third-party notices](THIRD_PARTY_NOTICES.md). This is an independent project built using scrcpy and is not an official Genymobile product.
