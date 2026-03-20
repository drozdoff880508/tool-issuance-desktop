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
    // Production: use extraResources paths
    // extraResources copies:
    // - node/ -> resources/node/
    // - .next/standalone -> resources/standalone/
    
    nodeExePath = path.join(process.resourcesPath, 'node', 'node.exe');
    standalonePath = path.join(process.resourcesPath, 'standalone');
    serverPath = path.join(standalonePath, 'server.js');
  } else {
    // Development
    const appPath = path.join(__dirname, '..');
    nodeExePath = path.join(appPath, 'node', 'node.exe');
    standalonePath = path.join(appPath, '.next', 'standalone');
    serverPath = path.join(standalonePath, 'server.js');
  }

  console.log('=== Path Debug Info ===');
  console.log('isPackaged:', isProd);
  console.log('resourcesPath:', process.resourcesPath);
  console.log('nodeExePath:', nodeExePath);
  console.log('standalonePath:', standalonePath);
  console.log('serverPath:', serverPath);
  console.log('node exists:', fs.existsSync(nodeExePath));
  console.log('server exists:', fs.existsSync(serverPath));
  console.log('======================');

  // Show error if node not found
  if (!fs.existsSync(nodeExePath)) {
    const errorHtml = `
      <html>
        <body style="font-family: Arial; padding: 20px;">
          <h1 style="color: red;">Error: Node.js not found</h1>
          <p>Expected location: ${nodeExePath}</p>
          <p>Resources path: ${process.resourcesPath}</p>
          <h3>Files in resources:</h3>
          <pre>${listDir(process.resourcesPath)}</pre>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
    return;
  }

  // Show error if server not found
  if (!fs.existsSync(serverPath)) {
    const errorHtml = `
      <html>
        <body style="font-family: Arial; padding: 20px;">
          <h1 style="color: red;">Error: Server not found</h1>
          <p>Expected location: ${serverPath}</p>
          <p>Standalone path: ${standalonePath}</p>
          <h3>Files in standalone:</h3>
          <pre>${fs.existsSync(standalonePath) ? listDir(standalonePath) : 'Directory not found'}</pre>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
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
    const errorHtml = `
      <html>
        <body style="font-family: Arial; padding: 20px;">
          <h1 style="color: red;">Error starting server</h1>
          <p>${err.message}</p>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
  });

  nextProcess.stdout.on('data', (data) => {
    console.log('Server stdout:', data.toString());
  });

  nextProcess.stderr.on('data', (data) => {
    console.error('Server stderr:', data.toString());
  });

  nextProcess.on('close', (code) => {
    console.log('Server process closed with code:', code);
  });

  // Wait for server to start then load the page
  const checkServer = () => {
    const http = require('http');
    const req = http.get(`http://localhost:${port}`, (res) => {
      if (res.statusCode === 200 || res.statusCode === 302) {
        mainWindow.loadURL(`http://localhost:${port}`);
      }
    });
    req.on('error', () => {
      // Server not ready yet, try again
      setTimeout(checkServer, 500);
    });
  };
  
  // Start checking after 2 seconds
  setTimeout(checkServer, 2000);
}

function listDir(dir) {
  try {
    const items = fs.readdirSync(dir);
    return items.map(item => {
      const itemPath = path.join(dir, item);
      const isDir = fs.statSync(itemPath).isDirectory();
      return isDir ? `[DIR] ${item}` : `${item}`;
    }).join('\n');
  } catch (e) {
    return `Error: ${e.message}`;
  }
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
