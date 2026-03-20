const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let serverProcess = null

function getResourcePath(...args) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...args)
  }
  return path.join(__dirname, ...args)
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Система выдачи инструмента',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.loadURL('http://localhost:3000').catch(() => {
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:3000')
    }, 2000)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const menu = Menu.buildFromTemplate([
    {
      label: 'Файл',
      submenu: [{ role: 'quit', label: 'Выход' }]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе',
              message: 'Система выдачи инструмента',
              detail: 'Версия 1.0.0\n\nАвтоматизированная система учёта выдачи инструмента в цехе металлоконструкций.'
            })
          }
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}

function startServer() {
  return new Promise((resolve) => {
    const appPath = getResourcePath('app')
    
    console.log('Starting server from:', appPath)
    
    serverProcess = spawn('node', ['server.js'], {
      cwd: appPath,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3000'
      },
      stdio: 'pipe'
    })

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`)
    })

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`)
    })

    setTimeout(resolve, 3000)
  })
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

app.whenReady().then(async () => {
  try {
    await startServer()
    createWindow()
  } catch (error) {
    console.error('Failed to start:', error)
    dialog.showErrorBox('Ошибка запуска', `Не удалось запустить сервер: ${error.message}`)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopServer()
  app.quit()
})

app.on('before-quit', () => {
  stopServer()
})
