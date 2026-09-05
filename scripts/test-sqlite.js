'use strict';
/**
 * SQLite 存储验证（Electron 环境运行，better-sqlite3 需为 Electron ABI）：
 *   npx electron scripts/test-sqlite.js
 * 覆盖：内存库完整流程 + 文件持久化重启。
 * 退出码：0=通过，1=失败。
 */
const { app } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { initApp } = require('../src/main/db');

const ROOT = path.join(__dirname, '..');
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok - ${name}`);
  } else {
    failed++;
    console.error(`  FAIL - ${name}${detail ? ' :: ' + detail : ''}`);
  }
}

app.whenReady().then(() => {
  const packDir = path.join(ROOT, 'src', 'assets', 'content', 'grade1');

  // ---- 1. 内存库完整流程 ----
  console.log('== 内存库流程 ==');
  const dbMem = ':memory:';
  const ctx1 = initApp(dbMem, packDir);
  const u = ctx1.core.createUser({ nickname: 'SQLite验证' });
  const s = ctx1.core.getSession(u.user_id);
  check('新会话出题', s.newItems.length >= 1 && s.newItems[0].chars[0].char_id);
  const c1 = s.newItems[0].chars[0];
  const r1 = ctx1.core.submitSession(u.user_id, [{ charId: c1.char_id, known: true }]);
  check('初次认识进第四仓库', r1.results[0].to === 4, `to=${r1.results[0].to}`);
  check('skill 更新', ctx1.core.getLevel(u.user_id).skill_level === 1);
  const s2 = ctx1.core.getSession(u.user_id);
  const c2 = s2.newItems[0].chars[0];
  const r2 = ctx1.core.submitSession(u.user_id, [{ charId: c2.char_id, known: false }]);
  check('不认识进第一仓库', r2.results[0].to === 1, `to=${r2.results[0].to}`);
  // 间隔配置
  const st = ctx1.core.updateSettings({ delays: { 4: 60 } });
  check('间隔可配', st.delays[4] === 60);
  ctx1.storage.close();

  // ---- 2. 文件持久化重启 ----
  console.log('== 文件持久化 ==');
  const dbPath = path.join(os.tmpdir(), `123renzi-sqlite-${process.pid}-${Date.now()}.db`);
  let ctx = initApp(dbPath, packDir);
  const u2 = ctx.core.createUser({ nickname: '持久化' });
  const ss = ctx.core.getSession(u2.user_id);
  const cc = ss.newItems[0].chars[0];
  ctx.core.submitSession(u2.user_id, [{ charId: cc.char_id, known: true }]);
  const uid = u2.user_id;
  ctx.storage.close();
  // 重新打开
  ctx = initApp(dbPath, packDir);
  const prog = ctx.core.getProgress(uid);
  check('重启后进度仍在', prog.rows.length === 1 && prog.rows[0].warehouse === 4, `rows=${prog.rows.length}`);
  check('重启后用户仍在', ctx.core.listUsers().length === 1);
  // 间隔配置持久化
  ctx.core.updateSettings({ delays: { 2: 5 } });
  ctx.storage.close();
  ctx = initApp(dbPath, packDir);
  check('间隔配置持久化', ctx.core.getSettings().delays[2] === 5, `d2=${ctx.core.getSettings().delays[2]}`);
  ctx.storage.close();
  try { fs.unlinkSync(dbPath); } catch (e) { /* ignore */ }

  console.log(failed === 0 ? 'SQLITE_TEST PASS' : `SQLITE_TEST FAIL (${failed})`);
  app.exit(failed === 0 ? 0 : 1);
});
