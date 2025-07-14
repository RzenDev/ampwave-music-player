const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.png'), // Puedes poner tu icono aquí
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'AmpWave Music Player',
    autoHideMenuBar: true
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 