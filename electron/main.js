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
    title: 'Tool Issuance System'
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'Файл',
      submenu: [
        { role: 'quit', label: 'Выход' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { role: 'toggledevtools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetzoom', label: 'Сбросить масштаб' },
        { role: 'zoomin', label: 'Увеличить' },
        { role: 'zoomout', label: 'Уменьшить' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  // Start server and load the app
  startNextServer();
}

function startNextServer() {
  const port = 3000;
  
  // Get the correct paths
  let appPath;
  let nodePath;
  let serverPath;
  
  if (app.isPackaged) {
    // Production: use resources path
    appPath = path.join(process.resourcesPath, 'app');
    nodePath = path.join(process.resourcesPath, 'node', 'node.exe');
    serverPath = path.join(appPath, '.next', 'standalone', 'server.js');
  } else {
    // Development
    appPath = path.join(__dirname, '..');
    nodePath = path.join(appPath, 'node', 'node.exe');
    serverPath = path.join(appPath, '.next', 'standalone', 'server.js');
  }

  console.log('App path:', appPath);
  console.log('Node path:', nodePath);
  console.log('Server path:', serverPath);

  // Check if node exists
  if (!require('fs').existsSync(nodePath)) {
    console.error('Node.js not found at:', nodePath);
    mainWindow.loadURL(`data:text/html,<h1>Error: Node.js not found</h1><p>Expected at: ${nodePath}</p>`);
    return;
  }

  // Set environment variables
  const env = {
    ...process.env,
    PORT: port.toString(),
    HOSTNAME: 'localhost',
    NODE_ENV: 'production'
  };

  // Spawn Next.js server using bundled Node.js
  nextProcess = spawn(nodePath, [serverPath], {
    cwd: path.join(appPath, '.next', 'standalone'),
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  nextProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    mainWindow.loadURL(`data:text/html,<h1>Error starting server</h1><p>${err.message}</p>`);
  });

  nextProcess.stdout.on('data', (data) => {
    console.log('Server:', data.toString());
  });

  nextProcess.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });

  nextProcess.on('close', (code) => {
    console.log('Server process closed with code:', code);
  });

  // Wait for server to start then load the page
  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${port}`).catch(err => {
      console.error('Failed to load page:', err);
      mainWindow.loadURL(`data:text/html,<h1>Failed to connect to server</h1><p>Error: ${err.message}</p><p>Port: ${port}</p><p>Server should be running...</p>`);
    });
  }, 4000);
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
