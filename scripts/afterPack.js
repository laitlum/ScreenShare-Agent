/**
 * electron-builder afterPack hook.
 * Runs rcedit on the packaged exe to set the icon and version strings
 * without needing code-signing tools or admin privileges.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const root = path.join(__dirname, '..');
  const rceditExe = path.join(root, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');
  const iconPath = path.join(root, 'logo.ico');

  // The packaged exe lives in appOutDir and is named after productName
  const productName = context.packager.appInfo.productName;
  const packedExe = path.join(context.appOutDir, `${productName}.exe`);

  if (!fs.existsSync(packedExe)) {
    console.warn(`⚠️  afterPack: exe not found at ${packedExe}, skipping.`);
    return;
  }

  if (!fs.existsSync(iconPath)) {
    console.warn('⚠️  afterPack: logo.ico not found, skipping icon patch.');
    return;
  }

  const args = [
    packedExe,
    '--set-icon', iconPath,
    '--set-version-string', 'FileDescription', productName,
    '--set-version-string', 'ProductName', productName,
    '--set-version-string', 'OriginalFilename', `${productName}.exe`,
    '--set-version-string', 'InternalName', productName,
  ];

  console.log(`🔧 afterPack: patching ${packedExe} with icon and version strings...`);
  const result = spawnSync(rceditExe, args, { stdio: 'inherit' });

  if (result.status !== 0) {
    throw new Error(`rcedit failed with exit code ${result.status}`);
  }

  console.log('✅ afterPack: exe patched successfully.');
};
