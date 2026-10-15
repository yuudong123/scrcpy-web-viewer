// SPDX-License-Identifier: MIT
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = '5.0.1';
const archiveName = `scrcpy-win64-v${version}.zip`;
const archivePath = path.join(root, archiveName);
const runtime = path.join(root, `scrcpy-win64-v${version}`);
const sha256 = 'b12a2c4ee8be317422451fc7dcf8ee20a71b5ea7ef9ad73ddd825a25316227a5';
const url = `https://github.com/Genymobile/scrcpy/releases/download/v${version}/${archiveName}`;

async function exists(file) { try { await access(file); return true; } catch { return false; } }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} exited with code ${result.status}`);
}
async function setup() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This setup supports Windows x64 only.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Install Node.js 22 or newer first.');
  if (!await exists(path.join(runtime, 'adb.exe')) || !await exists(path.join(runtime, 'scrcpy-server')) || !await exists(path.join(runtime, 'scrcpy.exe'))) {
    if (!await exists(archivePath)) {
      console.log(`Downloading official scrcpy ${version} for Windows x64...`);
      const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error(`scrcpy download failed: HTTP ${response.status}`);
      const archive = Buffer.from(await response.arrayBuffer());
      if (createHash('sha256').update(archive).digest('hex') !== sha256) throw new Error('scrcpy SHA-256 mismatch. Nothing was extracted.');
      await writeFile(archivePath, archive);
    }
    const archive = await readFile(archivePath);
    if (createHash('sha256').update(archive).digest('hex') !== sha256) throw new Error(`SHA-256 mismatch. Remove ${archiveName} and run setup again.`);
    console.log('SHA-256 verified. Extracting scrcpy...');
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Expand-Archive -LiteralPath $env:SCRCPY_SETUP_ZIP -DestinationPath $env:SCRCPY_SETUP_ROOT -Force'],
    { env: { ...process.env, SCRCPY_SETUP_ZIP: archivePath, SCRCPY_SETUP_ROOT: root } });
  } else console.log(`Using existing scrcpy ${version} runtime.`);
  console.log('Installing locked web dependencies...');
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd ci --no-fund --no-audit'], { cwd: path.join(root, 'web') });
  console.log('\nSetup complete. Connect your phone, run start-web.cmd, then open http://localhost:8765');
}
setup().catch(error => { console.error(`Setup failed: ${error.message}`); process.exitCode = 1; });
