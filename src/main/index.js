'use strict';
/**
 * 主进程：创建窗口、注册 IPC。
 * 渲染层通过 window.api（preload 暴露）与主进程交互。
 */
const path = require('path');
const { app, BrowserWindow } = require('electron');
const { initApp, defaultDbPath } = require('./db');
const { registerIpc } = require('./ipc');

let ctx = null;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 780,
    minWidth: 860,
    minHeight: 640,
    title: '123认字',
    backgroundColor: '#fff7ea',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  const dbPath = defaultDbPath(app.getPath('userData'));
  const packDir = path.join(__dirname, '..', 'assets', 'content', 'full');
  try {
    ctx = initApp(dbPath, packDir);
  } catch (e) {
    // 首版兜底：SQLite 失败时退回内存存储（进度不持久，但可运行）
    const { createMemoryStorage } = require('../core/storage');
    const { createAppCore } = require('../core/index');
    const { loadPack } = require('../core/content');
    ctx = createAppCore(createMemoryStorage(), loadPack(packDir));
    console.warn('[123认字] SQLite 初始化失败，已回退内存存储：', e.message);
  }
  registerIpc(ctx);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
