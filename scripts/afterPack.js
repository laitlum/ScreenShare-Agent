/**
 * electron-builder afterPack hook.
 * Embeds the icon and version strings into the Windows exe.
 * Uses resedit (pure Node.js) so it works when cross-compiling on macOS/Linux.
 */
const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const root = path.join(__dirname, '..');
  const iconPath = path.join(root, 'logo.ico');
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

  console.log(`🔧 afterPack: patching ${packedExe} with icon and version strings...`);

  try {
    const ResEdit = require('resedit');
    const { NtExecutable, NtExecutableResource, Data, Resource } = ResEdit;

    const exeData = fs.readFileSync(packedExe);
    const exe = NtExecutable.from(exeData);
    const res = NtExecutableResource.from(exe);

    // Embed icon
    const icoData = fs.readFileSync(iconPath);
    const icoFile = Data.IconFile.from(icoData);
    Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      1,
      1033,
      icoFile.icons.map((i) => i.data)
    );

    // Update version strings
    const versionInfo = Resource.VersionInfo.fromEntries(res.entries);
    if (versionInfo.length > 0) {
      const vi = versionInfo[0];
      vi.setStringValues(
        { lang: 1033, codepage: 1200 },
        {
          FileDescription: productName,
          ProductName: productName,
          OriginalFilename: `${productName}.exe`,
          InternalName: productName,
        }
      );
      vi.outputToResourceEntries(res.entries);
    }

    res.outputResource(exe);
    const newExeData = exe.generate();
    fs.writeFileSync(packedExe, Buffer.from(newExeData));

    console.log('✅ afterPack: exe patched successfully.');
  } catch (err) {
    console.warn('⚠️  afterPack: resedit failed —', err.message);
  }
};
