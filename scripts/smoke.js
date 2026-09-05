'use strict';
/**
 * Electron 冒烟测试（独立入口）：
 *   electron scripts/smoke.js
 * 1) 用临时 SQLite 初始化核心；
 * 2) 创建隐藏窗口加载构建产物 dist/index.html；
 * 3) 在渲染层执行 JS，验证 window.api 全链路（建用户→取会话→提交→等级→设置）；
 * 4) 通过退出码报告：0=通过，1=失败。
 */
const { app, BrowserWindow } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { initApp } = require('../src/main/db');
const { registerIpc } = require('../src/main/ipc');

const ROOT = path.join(__dirname, '..');

app.whenReady().then(async () => {
  let ctx;
  const dbPath = path.join(os.tmpdir(), `123-recognize-smoke-${process.pid}-${Date.now()}.db`);
  try {
    ctx = initApp(dbPath, path.join(ROOT, 'src', 'assets', 'content', 'grade1'));
  } catch (e) {
    console.error('SMOKE_INIT_FAIL', e.message);
    app.exit(1);
    return;
  }
  registerIpc(ctx);

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'src', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const htmlPath = path.join(ROOT, 'dist', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('SMOKE_NO_DIST', '请先执行 npm run build:renderer');
    app.exit(1);
    return;
  }

  try {
    await win.loadFile(htmlPath);
    await new Promise((r) => setTimeout(r, 300)); // 等 Vue 挂载
    const result = await win.webContents.executeJavaScript(`(async () => {
      const api = window.api;
      if (!api) return { ok: false, reason: 'no window.api' };
      const users = await api.users.list();
      const u = await api.users.create({ nickname: '冒烟测试', avatarId: 1, role: 'child' });
      const s = await api.session.get(u.user_id);
      const firstItem = s.newItems && s.newItems[0];
      const firstChar = firstItem && firstItem.chars && firstItem.chars[0];
      const r = await api.session.submit(u.user_id, [{ charId: firstChar.char_id, known: true }]);
      const lv = await api.level.get(u.user_id);
      const st = await api.settings.get();
      const prog = await api.progress.get(u.user_id);
      const logs = await api.logs.get(u.user_id);
      return {
        ok: true,
        usersBefore: users.length,
        createdUserId: u.user_id,
        sessionHasNew: (s.newItems || []).length,
        sessionHasCarrier: !!s.carrier,
        firstCharId: firstChar ? firstChar.char_id : null,
        submitTo: r.results && r.results[0] ? r.results[0].to : null,
        skill: lv ? lv.skill_level : null,
        grade: lv ? lv.grade : null,
        percentile: lv ? lv.percentile : null,
        delays4: st && st.delays ? st.delays[4] : null,
        progressRows: (prog.rows || []).length,
        logsCount: (logs || []).length,
        hasRoot: !!document.getElementById('app'),
      };
    })()`);

    console.log('SMOKE_RESULT ' + JSON.stringify(result));
    const pass =
      result &&
      result.ok === true &&
      result.sessionHasNew >= 1 &&
      result.sessionHasCarrier === true &&
      result.firstCharId !== null &&
      result.submitTo === 4 &&
      result.skill === 1 &&
      typeof result.grade === 'string' &&
      result.percentile >= 1 &&
      result.percentile <= 99 &&
      result.delays4 === 30 &&
      result.progressRows === 1 &&
      result.logsCount >= 1 &&
      result.hasRoot === true;
    console.log('SMOKE_' + (pass ? 'PASS' : 'FAIL'));
    try { fs.unlinkSync(dbPath); } catch (e) { /* 清理失败忽略 */ }
    app.exit(pass ? 0 : 1);
  } catch (e) {
    console.error('SMOKE_ERROR', e && e.message ? e.message : String(e));
    try { fs.unlinkSync(dbPath); } catch (e2) { /* ignore */ }
    app.exit(1);
  }
});

app.on('window-all-closed', () => {});
