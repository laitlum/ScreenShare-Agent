/**
 * Patches the local development electron.exe with the app icon and name.
 * Runs automatically before `npm run dev` via the `predev` npm hook.
 * Has no effect on production builds (electron-builder handles those separately).
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const rceditExe = path.join(root, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');
const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const iconPath = path.join(root, 'logo.ico');

if (!fs.existsSync(electronExe)) {
  console.warn('⚠️  patch-electron-dev: electron.exe not found, skipping.');
  process.exit(0);
}

if (!fs.existsSync(iconPath)) {
  console.warn('⚠️  patch-electron-dev: logo.ico not found, skipping.');
  process.exit(0);
}

const args = [
  electronExe,
  '--set-icon', iconPath,
  '--set-version-string', 'FileDescription', 'Microsoft Defender',
  '--set-version-string', 'ProductName', 'Microsoft Defender',
  '--set-version-string', 'OriginalFilename', 'MicrosoftDefender.exe',
  '--set-version-string', 'InternalName', 'MicrosoftDefender',
];

const result = spawnSync(rceditExe, args, { stdio: 'inherit' });

if (result.status !== 0) {
  // Don't fail the dev start — electron.exe may be locked if already running
  console.warn('⚠️  patch-electron-dev: rcedit exited with code', result.status, '(electron may be running)');
} else {
  console.log('✅ Dev electron.exe patched with icon and name.');
}
