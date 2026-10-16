const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Teyvat Rift — Elemental Arena',
    backgroundColor: '#0b1020',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const devURL = process.env.ELECTRON_START_URL;
  if (devURL) win.loadURL(devURL);
  else win.loadFile(path.join(__dirname, '../dist/index.html'));
  // Desktop 3D: hardware accel on, fullscreen toggle with F11
  win.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      win.setFullScreen(!win.isFullScreen());
    }
  });
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
