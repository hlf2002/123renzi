'use strict';
/**
 * 主进程数据初始化：SQLite + 核心域组装。
 * 与 Electron 解耦，便于单元测试。
 */
const path = require('path');
const { createSqliteStorage, available } = require('../core/sqlite-store');
const { createAppCore } = require('../core/index');
const { loadPack } = require('../core/content');

/**
 * 初始化应用上下文
 * @param {string} dbPath SQLite 文件路径
 * @param {string} packDir 字库包目录
 * @returns {{storage, core, pack}}
 */
function initApp(dbPath, packDir) {
  if (!available) {
    throw new Error('better-sqlite3 未安装或加载失败，请先执行 npm install');
  }
  const storage = createSqliteStorage(dbPath);
  const pack = loadPack(packDir);
  storage.upsertChars(pack.chars); // 幂等导入
  const core = createAppCore(storage, pack);
  return { storage, core, pack };
}

/** 默认数据目录（生产由 Electron app.getPath('userData') 注入） */
function defaultDbPath(userDataDir) {
  return path.join(userDataDir, 'recognize.db');
}

module.exports = { initApp, defaultDbPath };
