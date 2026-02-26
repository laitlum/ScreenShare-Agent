console.log('=== Minimal Electron Test ===');
console.log('Step 1: Requiring electron...');

const electron = require('electron');
console.log('Step 2: electron =', typeof electron, electron);

if (typeof electron === 'string') {
  console.log('ERROR: electron is a string (path), not the API object');
  console.log('This means we are NOT running in Electron process context');
  process.exit(1);
}

console.log('Step 3: Destructuring electron.app...');
const { app, BrowserWindow } = electron;
console.log('Step 4: app =', typeof app, app);

if (!app) {
  console.log('ERROR: app is undefined');
  process.exit(1);
}

console.log('Step 5: Setting app name...');
app.setName('Test App');
console.log('SUCCESS: App name set to:', app.getName());

app.whenReady().then(() => {
  console.log('SUCCESS: App is ready!');
  const win = new BrowserWindow({ width: 400, height: 300 });
  win.loadURL('data:text/html,<h1>Success!</h1>');
  console.log('Window created');
});
