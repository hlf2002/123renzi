'use strict';
/**
 * IPC 处理器注册：渲染层 window.api 与主进程核心的桥接。
 * 独立模块便于主进程与冒烟测试复用。
 */
const { ipcMain } = require('electron');

function intId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error('invalid id: ' + v);
  return n;
}

function registerIpc(ctx) {
  // ---- 用户 ----
  ipcMain.handle('users:list', () => ctx.core.listUsers());
  ipcMain.handle('users:create', (_e, payload) => {
    const nickname = String((payload && payload.nickname) || '').trim();
    if (!nickname) throw new Error('昵称不能为空');
    return ctx.core.createUser({ nickname, avatarId: payload.avatarId || 1, role: payload.role || 'child' });
  });
  ipcMain.handle('users:delete', (_e, userId) => {
    ctx.core.deleteUser(intId(userId));
    return { ok: true };
  });

  // ---- 会话（游戏主流程）----
  ipcMain.handle('session:get', (_e, userId) => ctx.core.getSession(intId(userId)));
  ipcMain.handle('session:submit', (_e, userId, results) => {
    const uid = intId(userId);
    if (!Array.isArray(results)) throw new Error('results must be array');
    return ctx.core.submitSession(uid, results);
  });
  ipcMain.handle('session:submitProbe', (_e, userId, known) => {
    return ctx.core.submitProbe(intId(userId), !!known);
  });

  // ---- 进度 / 等级 / 日志 ----
  ipcMain.handle('progress:get', (_e, userId) => ctx.core.getProgress(intId(userId)));
  ipcMain.handle('level:get', (_e, userId) => ctx.core.getLevel(intId(userId)));
  ipcMain.handle('logs:get', (_e, userId) => ctx.core.getLogs(intId(userId)));

  // ---- 家长设置（复习间隔可配）----
  ipcMain.handle('settings:get', () => ctx.core.getSettings());
  ipcMain.handle('settings:set', (_e, patch) => ctx.core.updateSettings(patch || {}));

  // ---- 汉字教学（读字/组词/解释/造句/用法）----
  const charTeacher = require('../core/char-teacher');
  ipcMain.handle('teacher:teach', (_e, char, context) => charTeacher.teach(char || {}, context || {}));
}

module.exports = { registerIpc };
