'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { createMemoryStorage } = require('../src/core/storage');
const { createAppCore } = require('../src/core/index');
const { loadPack } = require('../src/core/content');

const PACK_DIR = path.join(__dirname, '..', 'src', 'assets', 'content', 'grade1');

function setup() {
  const pack = loadPack(PACK_DIR);
  const core = createAppCore(createMemoryStorage(), pack);
  const u = core.createUser({ nickname: '小明' });
  return { core, u, pack };
}

test('新用户 session：新字 + 载体 + 无复习', () => {
  const { core, u } = setup();
  const s = core.getSession(u.user_id);
  assert.ok(s.newItems.length >= 1, '有新学内容');
  assert.equal(s.reviewItems.length, 0, '新用户无复习');
  assert.ok(['char', 'word', 'phrase', 'sentence'].includes(s.carrier));
  assert.ok(s.counts, '有仓库统计');
});

test('新字全部认识 → 直接进第四仓库，skill 上升', () => {
  const { core, u } = setup();
  const s = core.getSession(u.user_id);
  const results = [];
  for (const item of s.newItems) {
    for (const ch of item.chars) {
      if (ch.char_id) results.push({ charId: ch.char_id, known: true });
    }
  }
  const r = core.submitSession(u.user_id, results);
  assert.ok(r.results.length > 0);
  assert.ok(r.results.every((x) => x.to === 4), '初次认识全部进第四仓库');
  assert.equal(r.level.skill_level, r.results.length);
});

test('不认识的字：学习进 W1 → 当天复测 → 隔天升 W2（完整复习闭环）', () => {
  const { core, u } = setup();
  const s = core.getSession(u.user_id);
  const first = s.newItems[0].chars[0];
  // 不认识 → 学习进 W1
  let r = core.submitSession(u.user_id, [{ charId: first.char_id, known: false }]);
  assert.equal(r.results[0].to, 1);
  // 当天复测认识 → 仍 W1（+1 天）
  r = core.submitSession(u.user_id, [{ charId: first.char_id, known: true }]);
  assert.equal(r.results[0].to, 1);
  // 隔天认识 → W2
  const p = core.getProgress(u.user_id).rows.find((x) => x.char_id === first.char_id);
  const next = new Date(p.next_review_at).getTime();
  r = core.submitSession(u.user_id, [{ charId: first.char_id, known: true }], next);
  assert.equal(r.results[0].to, 2);
});

test('第四仓库的字被发现不认识 → 回到第一仓库', () => {
  const { core, u } = setup();
  const s = core.getSession(u.user_id);
  const first = s.newItems[0].chars[0];
  core.submitSession(u.user_id, [{ charId: first.char_id, known: true }]); // W4
  assert.equal(core.getProgress(u.user_id).rows.find((x) => x.char_id === first.char_id).warehouse, 4);
  core.submitSession(u.user_id, [{ charId: first.char_id, known: false }]); // 不认识 → W1
  assert.equal(core.getProgress(u.user_id).rows.find((x) => x.char_id === first.char_id).warehouse, 1);
});

test('持续评估：最近10题正确率≥85%自动跳级（集成，不用学完当前年级）', () => {
  const { core, u } = setup();
  const before = core.getLevel(u.user_id).band;
  // 连续 10 轮各提交 1 个全对字 → 累计 10 题全对 → 跳级
  for (let round = 0; round < 10; round++) {
    const s = core.getSession(u.user_id);
    const char = s.newItems[0] && s.newItems[0].chars[0];
    if (char && char.char_id) core.submitSession(u.user_id, [{ charId: char.char_id, known: true }]);
  }
  const after = core.getLevel(u.user_id).band;
  assert.ok(after >= before + 1 || after >= 1, '最近10题全对应触发跳级（band 至少 +1）');
});

test('多用户隔离：不同用户进度互不影响', () => {
  const { core, u } = setup();
  const u2 = core.createUser({ nickname: '小红' });
  const s = core.getSession(u.user_id);
  const first = s.newItems[0].chars[0];
  core.submitSession(u.user_id, [{ charId: first.char_id, known: true }]);
  assert.ok(core.getProgress(u.user_id).rows.length > 0, '用户1有进度');
  assert.equal(core.getProgress(u2.user_id).rows.length, 0, '用户2无进度');
});

test('激励展示：grade + percentile 合法', () => {
  const { core, u } = setup();
  const lv = core.getLevel(u.user_id);
  assert.ok(typeof lv.grade === 'string' && lv.grade.length > 0);
  assert.ok(lv.percentile >= 1 && lv.percentile <= 99);
  assert.ok(lv.skill_level >= 0);
});

test('submitSession 非法输入防御', () => {
  const { core, u } = setup();
  assert.throws(() => core.submitSession(u.user_id, 'not-array'), TypeError);
  const r = core.submitSession(u.user_id, [{ charId: null, known: true }, null, { charId: 999999, known: true }]);
  assert.ok(Array.isArray(r.results));
});

test('家长设置：复习间隔可配并持久化生效', () => {
  const { core, u } = setup();
  const s = core.getSettings();
  assert.equal(s.delays[4], 30);
  const updated = core.updateSettings({ delays: { 4: 60 } });
  assert.equal(updated.delays[4], 60);
  // 再次读取（模拟重启）仍生效
  assert.equal(core.getSettings().delays[4], 60);
  // 初次认识进 W4 → +60 天
  const sess = core.getSession(u.user_id);
  const ch = sess.newItems[0].chars[0];
  core.submitSession(u.user_id, [{ charId: ch.char_id, known: true }]);
  const p = core.getProgress(u.user_id).rows.find((x) => x.char_id === ch.char_id);
  const gap = new Date(p.next_review_at).getTime() - Date.now();
  assert.ok(gap >= 59 * 24 * 3600 * 1000, 'W4 抽查间隔被配置覆盖为 60 天');
  // 非法间隔被拒绝
  assert.throws(() => core.updateSettings({ delays: { 2: -1 } }), TypeError);
});

test('字库包完整性：词句所有字都在字表内', () => {
  const { pack } = setup();
  const hanzi = new Set(pack.chars.map((c) => c.hanzi));
  for (const e of pack.pool) {
    for (const h of e.chars) assert.ok(hanzi.has(h), `词句 ${e.text} 含未收录字 ${h}`);
  }
});

test('字库小也能学完全部字（修复：band 提升后不再取空导致“词库只有20字”）', () => {
  const { core, u, pack } = setup();
  const seen = new Set();
  let guard = 0;
  while (true) {
    const s = core.getSession(u.user_id);
    if (!s.newItems || s.newItems.length === 0) break;
    const ids = [];
    s.newItems.forEach((item) => item.chars.forEach((c) => { if (c.char_id) ids.push(c.char_id); }));
    ids.forEach((id) => seen.add(id));
    core.submitSession(u.user_id, ids.map((id) => ({ charId: id, known: true })));
    guard += 1;
    assert.ok(guard < 200, '循环未收敛（可能死循环）');
  }
  assert.equal(seen.size, pack.chars.length, `全部 ${pack.chars.length} 个字都应能学到`);
});

test('持续评估按批跳级：一批 5 新字全对不瞬间跳级', () => {
  const { core, u } = setup();
  const s = core.getSession(u.user_id);
  const ids = [];
  s.newItems.forEach((item) => item.chars.forEach((c) => { if (c.char_id) ids.push(c.char_id); }));
  const r = core.submitSession(u.user_id, ids.map((id) => ({ charId: id, known: true })));
  assert.equal(r.events.filter((e) => e.type === 'jump').length, 0, '一批全对不应立即跳级');
  assert.equal(core.getLevel(u.user_id).band, 0);
});

test('年级与百分位：综合正确率+识字量，一直全对百分位上升', () => {
  const { core, u } = setup();
  let lv = core.getLevel(u.user_id);
  assert.equal(lv.grade, '幼小衔接', '未学字时显示幼小衔接');
  assert.equal(lv.percentile, 50, '未学字时百分位为默认50');
  // 学完全部 g1 字（一直全对）
  let guard = 0;
  while (true) {
    const s = core.getSession(u.user_id);
    if (!s.newItems || s.newItems.length === 0) break;
    const ids = [];
    s.newItems.forEach((item) => item.chars.forEach((c) => { if (c.char_id) ids.push(c.char_id); }));
    core.submitSession(u.user_id, ids.map((id) => ({ charId: id, known: true })));
    guard += 1;
    assert.ok(guard < 200, '循环未收敛');
  }
  lv = core.getLevel(u.user_id);
  // 一直全对会触发跳级，年级应≥一年级
  const gradeOrder = { '幼小衔接': 0, '一年级': 1, '二年级': 2, '三年级': 3, '四年级': 4, '五年级': 5, '六年级': 6, '初中': 7, '高中': 8 };
  assert.ok((gradeOrder[lv.grade] || 0) >= 1, '一直全对应至少到一年级');
  assert.ok(lv.percentile > 50, '一直全对应超过半数同龄人');
  assert.ok(lv.recent_accuracy >= 0.9, '一直全对应正确率≥90%');
});
