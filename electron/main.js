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

function log(message) {
  console.log(message);
  // Also write to a log file for debugging
  const logFile = path.join(app.getPath('temp'), 'tool-issuance-debug.log');
  try {
    fs.appendFileSync(logFile, new Date().toISOString() + ' - ' + message + '\n');
  } catch (e) {}
}

function listDir(dir, indent = '') {
  try {
    if (!fs.existsSync(dir)) return `${indent}[NOT FOUND: ${dir}]`;
    const items = fs.readdirSync(dir);
    return items.map(item => {
      const itemPath = path.join(dir, item);
      try {
        const isDir = fs.statSync(itemPath).isDirectory();
        if (isDir) {
          return `${indent}[DIR] ${item}`;
        }
        return `${indent}${item}`;
      } catch (e) {
        return `${indent}${item} (error: ${e.message})`;
      }
    }).join('\n');
  } catch (e) {
    return `${indent}Error: ${e.message}`;
  }
}

function startNextServer() {
  const port = 3000;
  
  log('=== Starting Next.js Server ===');
  log('isPackaged: ' + app.isPackaged);
  log('resourcesPath: ' + process.resourcesPath);
  log('appPath: ' + app.getAppPath());
  log('__dirname: ' + __dirname);
  
  const isProd = app.isPackaged;
  let nodeExePath, serverPath, standalonePath;
  
  if (isProd) {
    // Node from extraResources
    nodeExePath = path.join(process.resourcesPath, 'node', 'node.exe');
    
    // Standalone from asarUnpack
    standalonePath = path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone');
    serverPath = path.join(standalonePath, 'server.js');
    
    log('\n--- Checking paths ---');
    log('nodeExePath: ' + nodeExePath + ' -> exists: ' + fs.existsSync(nodeExePath));
    log('standalonePath: ' + standalonePath + ' -> exists: ' + fs.existsSync(standalonePath));
    log('serverPath: ' + serverPath + ' -> exists: ' + fs.existsSync(serverPath));
    
    log('\n--- Resources contents ---');
    log(listDir(process.resourcesPath));
    
    log('\n--- app.asar.unpacked contents ---');
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) {
      log(listDir(unpackedPath));
      log('\n--- .next contents (if exists) ---');
      const nextPath = path.join(unpackedPath, '.next');
      if (fs.existsSync(nextPath)) {
        log(listDir(nextPath));
      }
    } else {
      log('app.asar.unpacked not found');
    }
    
    // Check if node exists
    if (!fs.existsSync(nodeExePath)) {
      showError('Node.js not found', 
        `Path: ${nodeExePath}\n\nResources:\n${listDir(process.resourcesPath)}`);
      return;
    }

    // Check if server exists
    if (!fs.existsSync(serverPath)) {
      showError('Server not found', 
        `Path: ${serverPath}\n\nStandalone dir:\n${fs.existsSync(standalonePath) ? listDir(standalonePath) : 'Not found'}`);
      return;
    }
  } else {
    const appPath = path.join(__dirname, '..');
    nodeExePath = path.join(appPath, 'node', 'node.exe');
    standalonePath = path.join(appPath, '.next', 'standalone');
    serverPath = path.join(standalonePath, 'server.js');
  }

  // Set environment variables
  const env = {
    ...process.env,
    PORT: port.toString(),
    HOSTNAME: 'localhost',
    NODE_ENV: 'production'
  };

  log('\n--- Spawning server ---');
  log('Node: ' + nodeExePath);
  log('Server: ' + serverPath);
  log('CWD: ' + standalonePath);
  
  // Spawn Next.js server
  nextProcess = spawn(nodeExePath, [serverPath], {
    cwd: standalonePath,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  let serverError = '';

  nextProcess.on('error', (err) => {
    log('Failed to spawn: ' + err.message);
    showError('Error starting server', err.message + '\n\n' + serverOutput + '\n' + serverError);
  });

  nextProcess.stdout.on('data', (data) => {
    const msg = data.toString();
    serverOutput += msg;
    log('Server stdout: ' + msg);
  });

  nextProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    serverError += msg;
    log('Server stderr: ' + msg);
  });

  nextProcess.on('close', (code) => {
    log('Server closed with code: ' + code);
    if (code !== 0) {
      showError('Server crashed', 
        `Exit code: ${code}\n\nOutput:\n${serverOutput}\n\nError:\n${serverError}`);
    }
  });

  // Wait for server to start
  let attempts = 0;
  const maxAttempts = 40;
  
  const checkServer = () => {
    attempts++;
    log('Checking server, attempt ' + attempts);
    
    const http = require('http');
    const req = http.get(`http://localhost:${port}`, (res) => {
      log('Server responded with status: ' + res.statusCode);
      mainWindow.loadURL(`http://localhost:${port}`);
    });
    req.on('error', (err) => {
      log('Check failed: ' + err.message);
      if (attempts < maxAttempts) {
        setTimeout(checkServer, 500);
      } else {
        showError('Server timeout', 
          `Server did not respond after ${maxAttempts} attempts\n\nServer output:\n${serverOutput}\n\nServer error:\n${serverError}`);
      }
    });
    req.setTimeout(2000, () => {
      req.destroy();
    });
  };
  
  setTimeout(checkServer, 3000);
}

function showError(title, message) {
  const logFile = path.join(app.getPath('temp'), 'tool-issuance-error.log');
  try {
    fs.writeFileSync(logFile, `${title}\n\n${message}`);
  } catch (e) {}
  
  const errorHtml = `
    <html>
      <head><style>
        body{font-family:Consolas,monospace;padding:20px;background:#1a1a1a;color:#fff;}
        h1{color:#ff6b6b;}
        pre{background:#2a2a2a;padding:15px;overflow:auto;white-space:pre-wrap;word-wrap:break-word;}
      </style></head>
      <body>
        <h1>${title}</h1>
        <pre>${message}</pre>
        <p><small>Log saved to: ${logFile}</small></p>
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
