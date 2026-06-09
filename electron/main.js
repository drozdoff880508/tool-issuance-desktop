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
    title: 'Система выдачи инструмента',
    show: false // Скрываем до загрузки
  });

  // Показываем окно когда готово
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Минимальное меню
  const menu = Menu.buildFromTemplate([
    { label: 'Файл', submenu: [{ role: 'quit', label: 'Выход' }] },
    { label: 'Вид', submenu: [{ role: 'reload', label: 'Обновить' }] }
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
  if (mainWindow) {
    mainWindow.loadURL('data:text/html,' + encodeURIComponent(html));
    mainWindow.show();
  }
}

function startNextServer() {
  const port = 3000;
  
  log('=== STARTING SERVER ===');
  log('isPackaged: ' + app.isPackaged);
  
  const isProd = app.isPackaged;
  let cwd, dbDir;
  
  if (isProd) {
    cwd = path.join(process.resourcesPath, 'standalone');
    
    // Папка данных рядом с EXE
    let appDir;
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      appDir = process.env.PORTABLE_EXECUTABLE_DIR;
    } else {
      appDir = path.dirname(app.getPath('exe'));
    }
    
    dbDir = path.join(appDir, 'data');
    log('appDir: ' + appDir);
    log('dbDir: ' + dbDir);
    
    if (!fs.existsSync(cwd)) {
      showError('Файлы не найдены', 'Папка: ' + cwd);
      return;
    }
  } else {
    cwd = path.join(__dirname, '.next', 'standalone');
    dbDir = path.join(__dirname, 'db');
  }

  // Создаём папку для данных
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log('Created data directory: ' + dbDir);
  }

  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: 'localhost',
    NODE_ENV: 'production',
    DATA_DIR: dbDir
  };

  log('DATA_DIR: ' + env.DATA_DIR);
  
  // Используем встроенный Node.js Electron
  nextProcess = spawn(process.execPath, ['server.js'], {
    cwd: cwd,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  nextProcess.on('error', err => {
    log('SPAWN ERROR: ' + err.message);
    showError('Ошибка запуска', err.message);
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
    if (code !== 0 && mainWindow) {
      showError('Ошибка сервера', 'Exit code: ' + code + '\n\n' + stdout + '\n' + stderr);
    }
  });

  // Проверяем запуск сервера
  let attempts = 0;
  const check = () => {
    attempts++;
    
    const http = require('http');
    const req = http.get('http://localhost:' + port, res => {
      log('Server responded: ' + res.statusCode);
      if (mainWindow) {
        mainWindow.loadURL('http://localhost:' + port);
      }
    });
    req.on('error', err => {
      log('Check error: ' + err.message);
      if (attempts < 30) setTimeout(check, 500);
      else showError('Таймаут запуска', 'Сервер не ответил за 15 секунд\n\n' + stdout + '\n' + stderr);
    });
    req.setTimeout(2000, () => req.destroy());
  };
  
  setTimeout(check, 1500);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (nextProcess) nextProcess.kill();
});
