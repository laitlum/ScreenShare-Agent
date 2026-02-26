console.log('Test file loading...');
console.log('typeof require:', typeof require);
console.log('Attempting to require electron...');

try {
  const electron = require('electron');
  console.log('electron:', electron);
  console.log('electron.app:', electron.app);

  if (electron.app) {
    console.log('✅ SUCCESS: electron.app is available');
    electron.app.whenReady().then(() => {
      console.log('✅ App is ready!');
      const { BrowserWindow } = electron;
      const win = new BrowserWindow({ width: 800, height: 600 });
      win.loadURL('data:text/html,<h1>Test Window</h1>');
    });
  } else {
    console.log('❌ FAIL: electron.app is undefined');
  }
} catch (e) {
  console.error('❌ Error requiring electron:', e.message);
}
