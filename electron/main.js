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

  const menu = Menu.buildFromTemplate([
    { label: 'Файл', submenu: [{ role: 'quit', label: 'Выход' }] },
    { label: 'Вид', submenu: [{ role: 'reload' }, { role: 'toggledevtools' }] }
  ]);
  Menu.setApplicationMenu(menu);

  startNextServer();
}

function log(msg) {
  console.log(msg);
  try {
    const logFile = path.join(app.getPath('temp'), 'tool-issuance.log');
    fs.appendFileSync(logFile, new Date().toISOString() + ' ' + msg + '\n');
  } catch(e) {}
}

function showError(title, msg) {
  log('ERROR: ' + title + ' - ' + msg);
  const html = `<html><head><style>
    body{font-family:Arial;padding:20px;background:#1a1a2e;color:#eee}
    h1{color:#ff6b6b}pre{background:#16213e;padding:15px;overflow:auto;white-space:pre-wrap;font-size:11px}
  </style></head><body><h1>${title}</h1><pre>${msg}</pre></body></html>`;
  mainWindow.loadURL('data:text/html,' + encodeURIComponent(html));
}

function startNextServer() {
  const port = 3000;
  
  log('=== STARTING SERVER ===');
  log('isPackaged: ' + app.isPackaged);
  log('PORTABLE_EXECUTABLE_DIR: ' + process.env.PORTABLE_EXECUTABLE_DIR);
  log('exe path: ' + app.getPath('exe'));
  log('cwd: ' + process.cwd());
  
  const isProd = app.isPackaged;
  let nodeExe, serverJs, cwd;
  let dbDir, dbPath;
  
  if (isProd) {
    nodeExe = path.join(process.resourcesPath, 'node', 'node.exe');
    cwd = path.join(process.resourcesPath, 'standalone');
    serverJs = path.join(cwd, 'server.js');
    
    // Используем PORTABLE_EXECUTABLE_DIR от electron-builder
    // Это реальная папка где лежит EXE файл
    let appDir;
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      appDir = process.env.PORTABLE_EXECUTABLE_DIR;
    } else {
      // Fallback - папка с exe
      appDir = path.dirname(app.getPath('exe'));
    }
    
    dbDir = path.join(appDir, 'data');
    dbPath = path.join(dbDir, 'custom.db');
    
    log('appDir (persistent): ' + appDir);
    log('dbDir: ' + dbDir);
    log('dbPath: ' + dbPath);
    
    if (!fs.existsSync(nodeExe)) {
      showError('Node.js not found', 'Path: ' + nodeExe);
      return;
    }
    if (!fs.existsSync(serverJs)) {
      showError('Server not found', 'Path: ' + serverJs);
      return;
    }
  } else {
    const appPath = path.join(__dirname, '..');
    nodeExe = path.join(appPath, 'node', 'node.exe');
    cwd = path.join(appPath, '.next', 'standalone');
    serverJs = path.join(cwd, 'server.js');
    dbDir = path.join(appPath, 'db');
    dbPath = path.join(dbDir, 'custom.db');
  }

  // Создаём папку для базы если нет
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log('Created db directory: ' + dbDir);
  }
  
  // Абсолютный путь к базе
  const absoluteDbPath = path.resolve(dbPath);
  log('Absolute DB path: ' + absoluteDbPath);
  log('DB exists: ' + fs.existsSync(absoluteDbPath));
  
  // Если базы данных нет - копируем seed базу
  if (!fs.existsSync(absoluteDbPath)) {
    log('Database not found, looking for seed database...');
    
    // Ищем seed базу в ресурсах
    const seedDbPath = isProd 
      ? path.join(process.resourcesPath, 'seed-db', 'seed.db')
      : path.join(__dirname, '..', 'seed-db', 'seed.db');
    
    log('Seed DB path: ' + seedDbPath);
    log('Seed DB exists: ' + fs.existsSync(seedDbPath));
    
    if (fs.existsSync(seedDbPath)) {
      try {
        // Копируем seed базу
        fs.copyFileSync(seedDbPath, absoluteDbPath);
        log('Seed database copied successfully to: ' + absoluteDbPath);
        
        // Проверяем размер
        const stats = fs.statSync(absoluteDbPath);
        log('Database size: ' + stats.size + ' bytes');
      } catch (e) {
        log('Failed to copy seed database: ' + e.message);
        showError('Database Error', 'Failed to initialize database:\n' + e.message);
        return;
      }
    } else {
      log('WARNING: Seed database not found at ' + seedDbPath);
      log('Application will start but may fail if database tables are missing');
    }
  }
  
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: 'localhost',
    NODE_ENV: 'production',
    DATABASE_URL: 'file:' + absoluteDbPath.replace(/\\/g, '/')
  };

  log('DATABASE_URL: ' + env.DATABASE_URL);
  
  nextProcess = spawn(nodeExe, [serverJs], {
    cwd: cwd,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  nextProcess.on('error', err => {
    log('SPAWN ERROR: ' + err.message);
    showError('Spawn Error', err.message);
  });

  nextProcess.stdout.on('data', data => {
    const s = data.toString();
    stdout += s;
    log('STDOUT: ' + s);
  });

  nextProcess.stderr.on('data', data => {
    const s = data.toString();
    stderr += s;
    log('STDERR: ' + s);
  });

  nextProcess.on('close', code => {
    log('SERVER CLOSED: code=' + code);
    if (code !== 0) {
      showError('Server Error', 'Exit code: ' + code + '\n\nSTDOUT:\n' + stdout + '\n\nSTDERR:\n' + stderr);
    }
  });

  // Check server
  let attempts = 0;
  const check = () => {
    attempts++;
    log('Checking server, attempt ' + attempts);
    
    const http = require('http');
    const req = http.get('http://localhost:' + port, res => {
      log('Server responded: ' + res.statusCode);
      mainWindow.loadURL('http://localhost:' + port);
    });
    req.on('error', err => {
      log('Check error: ' + err.message);
      if (attempts < 30) setTimeout(check, 500);
      else showError('Server Timeout', 'After 30 attempts\n\nSTDOUT:\n' + stdout + '\n\nSTDERR:\n' + stderr);
    });
    req.setTimeout(2000, () => req.destroy());
  };
  
  setTimeout(check, 2000);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => { if (nextProcess) nextProcess.kill(); });
