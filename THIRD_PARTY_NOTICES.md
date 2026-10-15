# Third-party components

The [MIT license](LICENSE) in this repository applies to this project's original code and documentation. It does not relicense third-party software.

| Component | Version | License | How it is obtained |
| --- | --- | --- | --- |
| [scrcpy](https://github.com/Genymobile/scrcpy) | 5.0.1 | [Apache-2.0](https://github.com/Genymobile/scrcpy/blob/v5.0.1/LICENSE) | Downloaded separately from the official Windows release by `setup.cmd`. |
| [ws](https://github.com/websockets/ws) | 8.22.0 | [MIT](https://github.com/websockets/ws/blob/8.22.0/LICENSE) | Installed from npm using the committed lockfile. |

The downloaded scrcpy Windows archive also includes ADB, FFmpeg, SDL, and other runtime components. These retain their respective upstream licenses and notices. Keep those notices with the downloaded package if you redistribute it. This source repository does not include that archive or its binaries.

The viewer uses the scrcpy 5.0.1 wire protocol. Protocol reference: [scrcpy's developer documentation](https://github.com/Genymobile/scrcpy/blob/v5.0.1/doc/develop.md) and [Streamer.java](https://github.com/Genymobile/scrcpy/blob/v5.0.1/server/src/main/java/com/genymobile/scrcpy/device/Streamer.java).

This is an independent project and is not affiliated with or endorsed by Genymobile or the scrcpy maintainers.
