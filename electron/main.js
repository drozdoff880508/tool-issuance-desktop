const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
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

  const menu = Menu.buildFromTemplate([
    { label: 'Файл', submenu: [{ role: 'quit', label: 'Выход' }] },
    { label: 'Вид', submenu: [
      { role: 'reload', label: 'Обновить' },
      { role: 'toggledevtools', label: 'DevTools' }
    ]}
  ]);
  Menu.setApplicationMenu(menu);

  startNextServer();
}

function log(msg) {
  console.log(msg);
  try {
    fs.appendFileSync(path.join(app.getPath('temp'), 'tool-issuance.log'), msg + '\n');
  } catch(e) {}
}

function startNextServer() {
  const port = 3000;
  const isProd = app.isPackaged;
  
  log('=== Tool Issuance System ===');
  log('isPackaged: ' + isProd);
  log('resourcesPath: ' + process.resourcesPath);
  
  let nodeExe, serverJs, workDir;
  
  if (isProd) {
    nodeExe = path.join(process.resourcesPath, 'node', 'node.exe');
    workDir = path.join(process.resourcesPath, 'standalone');
    serverJs = path.join(workDir, 'server.js');
    
    log('\n--- Path Check ---');
    log('nodeExe: ' + nodeExe + ' = ' + fs.existsSync(nodeExe));
    log('workDir: ' + workDir + ' = ' + fs.existsSync(workDir));
    log('serverJs: ' + serverJs + ' = ' + fs.existsSync(serverJs));
    
    // Проверяем db
    const dbPath = path.join(workDir, 'db', 'custom.db');
    log('dbPath: ' + dbPath + ' = ' + fs.existsSync(dbPath));
    
    // Проверяем prisma
    const prismaPath = path.join(workDir, 'prisma', 'schema.prisma');
    log('prismaPath: ' + prismaPath + ' = ' + fs.existsSync(prismaPath));
    
    // Проверяем node_modules/.prisma
    const prismaClient = path.join(workDir, 'node_modules', '.prisma', 'client');
    log('prismaClient: ' + prismaClient + ' = ' + fs.existsSync(prismaClient));
    
    // Проверяем @prisma/engines
    const enginesPath = path.join(workDir, 'node_modules', '@prisma', 'engines');
    if (fs.existsSync(enginesPath)) {
      log('engines: ' + fs.readdirSync(enginesPath).join(', '));
    } else {
      log('engines: NOT FOUND');
    }
    
    if (!fs.existsSync(nodeExe)) {
      return showError('Node.js не найден', nodeExe);
    }
    if (!fs.existsSync(serverJs)) {
      return showError('server.js не найден', serverJs);
    }
  } else {
    const appPath = path.join(__dirname, '..');
    nodeExe = path.join(appPath, 'node', 'node.exe');
    workDir = path.join(appPath, '.next', 'standalone');
    serverJs = path.join(workDir, 'server.js');
  }

  const env = {
    ...process.env,
    PORT: port.toString(),
    HOSTNAME: 'localhost',
    NODE_ENV: 'production'
  };

  log('\n--- Starting Server ---');
  log('Node: ' + nodeExe);
  log('CWD: ' + workDir);
  
  let stdout = '';
  let stderr = '';
  
  nextProcess = spawn(nodeExe, [serverJs], {
    cwd: workDir,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  nextProcess.stdout.on('data', (data) => {
    stdout += data.toString();
    log('OUT: ' + data.toString().trim());
  });

  nextProcess.stderr.on('data', (data) => {
    stderr += data.toString();
    log('ERR: ' + data.toString().trim());
  });

  nextProcess.on('error', (err) => {
    log('SPAWN ERROR: ' + err.message);
    showError('Ошибка запуска', err.message);
  });

  nextProcess.on('close', (code) => {
    log('EXIT CODE: ' + code);
    if (code !== 0 && code !== null) {
      showError('Сервер остановлен', 
        'Код: ' + code + '\n\nSTDOUT:\n' + stdout + '\n\nSTDERR:\n' + stderr);
    }
  });

  // Ждём сервер
  let attempts = 0;
  const check = () => {
    attempts++;
    const http = require('http');
    const req = http.get('http://localhost:' + port, (res) => {
      log('Server ready! Status: ' + res.statusCode);
      mainWindow.loadURL('http://localhost:' + port);
    });
    req.on('error', () => {
      if (attempts < 60) {
        setTimeout(check, 500);
      } else {
        showError('Таймаут сервера', 
          'Попыток: ' + attempts + '\n\nSTDOUT:\n' + stdout + '\n\nSTDERR:\n' + stderr);
      }
    });
    req.setTimeout(2000, () => req.destroy());
  };
  
  setTimeout(check, 2000);
}

function showError(title, msg) {
  const html = `<html><head><style>
    body{font-family:Arial;padding:20px;background:#1e1e1e;color:#fff;}
    h1{color:#f44;} pre{background:#2d2d2d;padding:15px;overflow:auto;white-space:pre-wrap;font-size:11px;}
  </style></head><body><h1>${title}</h1><pre>${msg}</pre></body></html>`;
  mainWindow.loadURL('data:text/html,' + encodeURIComponent(html));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (nextProcess) nextProcess.kill();
});
