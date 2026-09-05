'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { createMemoryStorage } = require('../src/core/storage');
const engine = require('../src/core/engine');

test('连续 5 次全对触发跳级（band+1）', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  engine.ensureLevel(storage, u.user_id);
  let events = [];
  for (let i = 0; i < 5; i++) {
    events = events.concat(engine.recordAnswer(storage, u.user_id, true).events);
  }
  assert.equal(events.filter((e) => e.type === 'jump').length, 1);
  assert.equal(storage.getLevel(u.user_id).band, 1);
});

test('连续 3 次答错触发降级（band-1）', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  const lv = engine.ensureLevel(storage, u.user_id);
  lv.band = 3;
  storage.setLevel(u.user_id, lv);
  let events = [];
  for (let i = 0; i < 3; i++) {
    events = events.concat(engine.recordAnswer(storage, u.user_id, false).events);
  }
  assert.equal(events.filter((e) => e.type === 'demote').length, 1);
  assert.equal(storage.getLevel(u.user_id).band, 2);
});

test('band 边界：跳级不超过上限、降级不低于 0', () => {
  const storage = createMemoryStorage();
  const u = storage.createUser({ nickname: 'a' });
  const lv = engine.ensureLevel(storage, u.user_id);
  lv.band = engine.BANDS - 1;
  storage.setLevel(u.user_id, lv);
  // 连续全对但 band 已到顶
  for (let i = 0; i < 6; i++) engine.recordAnswer(storage, u.user_id, true);
  assert.equal(storage.getLevel(u.user_id).band, engine.BANDS - 1);
  // band=0 连续答错不降穿
  const lv2 = storage.getLevel(u.user_id);
  lv2.band = 0;
  lv2.streak_wrong = 0;
  lv2.streak_full = 0;
  storage.setLevel(u.user_id, lv2);
  for (let i = 0; i < 4; i++) engine.recordAnswer(storage, u.user_id, false);
  assert.equal(storage.getLevel(u.user_id).band, 0);
});

test('答对打断答错计数', () => {
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
