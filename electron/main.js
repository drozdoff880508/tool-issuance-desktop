const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

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
  const isProd = app.isPackaged;
  
  let nodeExePath, serverPath, standalonePath;
  
  if (isProd) {
    // Production paths
    // asarUnpack extracts to app.asar.unpacked
    // extraResources extracts to resources/
    
    const appPath = app.getAppPath(); // points to app.asar
    
    // Node from extraResources
    nodeExePath = path.join(process.resourcesPath, 'node', 'node.exe');
    
    // Standalone from asarUnpack
    standalonePath = path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone');
    serverPath = path.join(standalonePath, 'server.js');
    
    console.log('=== Debug Info ===');
    console.log('resourcesPath:', process.resourcesPath);
    console.log('appPath:', appPath);
    console.log('nodeExePath:', nodeExePath);
    console.log('standalonePath:', standalonePath);
    console.log('node exists:', fs.existsSync(nodeExePath));
    console.log('standalone exists:', fs.existsSync(standalonePath));
    console.log('server exists:', fs.existsSync(serverPath));
    
    // List contents for debugging
    if (fs.existsSync(process.resourcesPath)) {
      console.log('Resources contents:', fs.readdirSync(process.resourcesPath));
    }
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) {
      console.log('Unpacked contents:', fs.readdirSync(unpackedPath));
    }
    console.log('==================');
  } else {
    // Development paths
    const appPath = path.join(__dirname, '..');
    nodeExePath = path.join(appPath, 'node', 'node.exe');
    standalonePath = path.join(appPath, '.next', 'standalone');
    serverPath = path.join(standalonePath, 'server.js');
  }

  // Check if node exists
  if (!fs.existsSync(nodeExePath)) {
    showError('Node.js not found', `Expected at: ${nodeExePath}`);
    return;
  }

  // Check if server exists
  if (!fs.existsSync(serverPath)) {
    showError('Server not found', `Expected at: ${serverPath}`);
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
  nextProcess = spawn(nodeExePath, [serverPath], {
    cwd: standalonePath,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  nextProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    showError('Error starting server', err.message);
  });

  nextProcess.stdout.on('data', (data) => {
    console.log('Server:', data.toString());
  });

  nextProcess.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });

  nextProcess.on('close', (code) => {
    console.log('Server closed with code:', code);
  });

  // Wait for server to start then load the page
  let attempts = 0;
  const maxAttempts = 30;
  
  const checkServer = () => {
    attempts++;
    const http = require('http');
    const req = http.get(`http://localhost:${port}`, (res) => {
      mainWindow.loadURL(`http://localhost:${port}`);
    });
    req.on('error', () => {
      if (attempts < maxAttempts) {
        setTimeout(checkServer, 500);
      } else {
        showError('Server timeout', `Server did not start after ${maxAttempts} attempts`);
      }
    });
  };
  
  setTimeout(checkServer, 2000);
}

function showError(title, message) {
  const errorHtml = `
    <html>
      <head><style>body{font-family:Arial;padding:20px;} h1{color:red;}</style></head>
      <body>
        <h1>${title}</h1>
        <pre>${message}</pre>
      </body>
    </html>
  `;
  mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
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
