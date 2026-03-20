const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, '../public/icon.ico'),
    title: 'Tool Issuance System'
  });

  // In production, start the Next.js server
  if (app.isPackaged) {
    startNextServer();
  } else {
    // In development, connect to the dev server
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

function startNextServer() {
  const serverPath = path.join(process.resourcesPath, 'app');
  
  // Start Next.js server
  nextProcess = spawn('node', ['node_modules/next/dist/bin/next', 'start'], {
    cwd: serverPath,
    stdio: 'inherit',
    env: { ...process.env, PORT: '3000' }
  });

  // Wait for server to start then load the page
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 3000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});
