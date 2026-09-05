'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { createMemoryStorage } = require('../src/core/storage');
const engine = require('../src/core/engine');

test('最近10题正确率≥85%触发跳级（不用学完当前年级）', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  engine.ensureLevel(storage, u.user_id);
  // 前9题全对：长度9 < MIN_ASSESS(10)，不评估
  for (let i = 0; i < 9; i++) engine.recordAnswer(storage, u.user_id, true);
  assert.equal(storage.getLevel(u.user_id).band, 0, '不足10题不跳级');
  // 第10题全对：长度10，正确率100%≥85% → 跳级
  const r = engine.recordAnswer(storage, u.user_id, true);
  assert.equal(r.events.filter((e) => e.type === 'jump').length, 1);
  assert.equal(storage.getLevel(u.user_id).band, 1);
});

test('最近10题正确率≤50%触发降级', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  const lv = engine.ensureLevel(storage, u.user_id);
  lv.band = 3;
  storage.setLevel(u.user_id, lv);
  // 10题中6错4对：正确率40%≤50% → 降级
  const seq = [false, true, false, true, false, true, false, true, false, false];
  let events = [];
  for (const k of seq) events = events.concat(engine.recordAnswer(storage, u.user_id, k).events);
  assert.equal(events.filter((e) => e.type === 'demote').length, 1);
  assert.equal(storage.getLevel(u.user_id).band, 2);
});

test('正确率介于50%~85%之间不跳不降', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  const lv = engine.ensureLevel(storage, u.user_id);
  lv.band = 2;
  storage.setLevel(u.user_id, lv);
  // 10题中7对3错：正确率70%，介于50%~85% → 不跳不降
  const seq = [true, true, true, true, true, true, true, false, false, false];
  let events = [];
  for (const k of seq) events = events.concat(engine.recordAnswer(storage, u.user_id, k).events);
  assert.equal(events.length, 0, '正确率70%不应触发跳级或降级');
  assert.equal(storage.getLevel(u.user_id).band, 2);
});

test('band 边界：跳级不超过上限、降级不低于 0', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  const lv = engine.ensureLevel(storage, u.user_id);
  lv.band = engine.BANDS - 1;
  storage.setLevel(u.user_id, lv);
  // 10题全对但 band 已到顶 → 不跳
  for (let i = 0; i < 10; i++) engine.recordAnswer(storage, u.user_id, true);
  assert.equal(storage.getLevel(u.user_id).band, engine.BANDS - 1);
  // band=0，10题全错 → 不降穿
  const lv2 = storage.getLevel(u.user_id);
  lv2.band = 0; lv2.recent = []; lv2.streak_wrong = 0; lv2.streak_full = 0;
  storage.setLevel(u.user_id, lv2);
  for (let i = 0; i < 10; i++) engine.recordAnswer(storage, u.user_id, false);
  assert.equal(storage.getLevel(u.user_id).band, 0);
});

test('跳级后重置窗口形成冷却（不会连续跳级）', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  engine.ensureLevel(storage, u.user_id);
  // 10题全对 → 跳级，窗口重置
  for (let i = 0; i < 10; i++) engine.recordAnswer(storage, u.user_id, true);
  assert.equal(storage.getLevel(u.user_id).band, 1);
  assert.equal(storage.getLevel(u.user_id).recent.length, 0, '跳级后窗口重置');
  // 再9题全对 → 不足10题，不跳
  for (let i = 0; i < 9; i++) engine.recordAnswer(storage, u.user_id, true);
  assert.equal(storage.getLevel(u.user_id).band, 1, '冷却期内不连续跳级');
});

test('答对打断答错计数（streak 字段）', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  engine.recordAnswer(storage, u.user_id, false);
  engine.recordAnswer(storage, u.user_id, false);
  engine.recordAnswer(storage, u.user_id, true); // 打断
  engine.recordAnswer(storage, u.user_id, false);
  assert.equal(storage.getLevel(u.user_id).streak_wrong, 1);
  assert.equal(storage.getLevel(u.user_id).streak_full, 0);
});

test('bandRange 边界', () => {
  assert.deepEqual(engine.bandRange(0), [1, 300]);
  assert.deepEqual(engine.bandRange(1), [301, 600]);
  assert.deepEqual(engine.bandRange(11), [3301, 3600]);
  assert.deepEqual(engine.bandRange(-1), [1, 300], '非法 band 归 0');
  assert.deepEqual(engine.bandRange(99), [3301, 3600], '超上限归 11');
});

test('recordAnswer 更新 skill_level 与正确率窗口', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  engine.recordAnswer(storage, u.user_id, true);
  engine.recordAnswer(storage, u.user_id, true);
  engine.recordAnswer(storage, u.user_id, false);
  const lv = storage.getLevel(u.user_id);
  assert.equal(lv.recent.length, 3);
  assert.ok(Math.abs(lv.recent_accuracy - 2 / 3) < 1e-9);
});

test('recordBatch：一批5个全对不足10题不跳级，累计10题全对跳级', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  engine.ensureLevel(storage, u.user_id);
  // 一批 5 个全对 → recent 长度5 < 10，不跳级
  const r1 = engine.recordBatch(storage, u.user_id, [
    { known: true }, { known: true }, { known: true }, { known: true }, { known: true },
  ]);
  assert.equal(r1.events.filter((e) => e.type === 'jump').length, 0, '一批5个全对不足10题不跳级');
  assert.equal(storage.getLevel(u.user_id).band, 0);
  // 再一批 5 个全对 → recent 长度10，正确率100% → 跳级
  engine.recordBatch(storage, u.user_id, [
    { known: true }, { known: true }, { known: true }, { known: true }, { known: true },
  ]);
  assert.equal(storage.getLevel(u.user_id).band, 1, '累计10题全对触发跳级');
});

test('recordBatch：一批内有答错拉低正确率，不触发跳级', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  engine.ensureLevel(storage, u.user_id);
  // 前4批全对（4题）
  for (let i = 0; i < 4; i++) engine.recordBatch(storage, u.user_id, [{ known: true }]);
  // 第5批2题1对1错 → recent 6题（5对1错，正确率83%），长度6<10不评估
  engine.recordBatch(storage, u.user_id, [{ known: true }, { known: false }]);
  assert.equal(storage.getLevel(u.user_id).band, 0, '不足10题且正确率未达标不跳级');
  // 再5批全对 → recent 11题（10对1错，正确率91%≥85%）→ 跳级
  for (let i = 0; i < 5; i++) engine.recordBatch(storage, u.user_id, [{ known: true }]);
  assert.equal(storage.getLevel(u.user_id).band, 1);
});
