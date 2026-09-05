'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { createMemoryStorage } = require('../src/core/storage');
const sched = require('../src/core/scheduler');

function setup() {
  const storage = createMemoryStorage();
  storage.upsertChars([
    { hanzi: '天', study_order: 1, content_pack: 'g' },
    { hanzi: '地', study_order: 2, content_pack: 'g' },
  ]);
  const u = storage.createUser({ nickname: 'a' });
  return { storage, u };
}

test('startLearning 进第一仓库，当天复测', () => {
  const { storage, u } = setup();
  const t = Date.now();
  const r = sched.startLearning(storage, u.user_id, 1, t);
  assert.equal(r.ok, true);
  const p = storage.getProgress(u.user_id, 1);
  assert.equal(p.warehouse, 1);
  assert.equal(new Date(p.next_review_at).getTime(), t, '当天复测');
});

test('startLearning 重复学习被拒绝', () => {
  const { storage, u } = setup();
  sched.startLearning(storage, u.user_id, 1, Date.now());
  const r = sched.startLearning(storage, u.user_id, 1, Date.now());
  assert.equal(r.ok, false);
});

test('initialKnown 直接进第四仓库 +30 天抽查', () => {
  const { storage, u } = setup();
  const t = Date.now();
  sched.initialKnown(storage, u.user_id, 1, t);
  const p = storage.getProgress(u.user_id, 1);
  assert.equal(p.warehouse, 4);
  assert.equal(new Date(p.next_review_at).getTime(), t + 30 * sched.DAY);
});

test('applyResult 认识逐步升级：W1→W2→W3→W4，间隔 +1/+3/+7/+30', () => {
  const { storage, u } = setup();
  const t0 = Date.now();
  sched.startLearning(storage, u.user_id, 1, t0);
  // 当天复测认识 → 仍 W1，+1 天
  let r = sched.applyResult(storage, u.user_id, 1, true, t0);
  assert.equal(r.to, 1);
  let p = storage.getProgress(u.user_id, 1);
  assert.equal(new Date(p.next_review_at).getTime(), t0 + 1 * sched.DAY);
  // 隔天(W1)认识 → W2，+3 天
  r = sched.applyResult(storage, u.user_id, 1, true, t0 + 1 * sched.DAY);
  assert.equal(r.to, 2);
  p = storage.getProgress(u.user_id, 1);
  assert.equal(new Date(p.next_review_at).getTime(), t0 + 1 * sched.DAY + 3 * sched.DAY);
  // W2 认识 → W3，+7 天
  p = storage.getProgress(u.user_id, 1);
  r = sched.applyResult(storage, u.user_id, 1, true, new Date(p.next_review_at).getTime());
  assert.equal(r.to, 3);
  // W3 认识 → W4，+30 天
  p = storage.getProgress(u.user_id, 1);
  r = sched.applyResult(storage, u.user_id, 1, true, new Date(p.next_review_at).getTime());
  assert.equal(r.to, 4);
  // W4 认识 → 保持 W4，+30 天
  p = storage.getProgress(u.user_id, 1);
  r = sched.applyResult(storage, u.user_id, 1, true, new Date(p.next_review_at).getTime());
  assert.equal(r.to, 4);
});

test('applyResult 不认识：任何仓库回 W1，当天复测', () => {
  const { storage, u } = setup();
  const t = Date.now();
  sched.initialKnown(storage, u.user_id, 1, t); // W4
  const r = sched.applyResult(storage, u.user_id, 1, false, t + 40 * sched.DAY);
  assert.equal(r.to, 1, 'W4 不认识回 W1');
  const p = storage.getProgress(u.user_id, 1);
  assert.equal(new Date(p.next_review_at).getTime(), t + 40 * sched.DAY, '当天复测');
});

test('applyResult 无进度时返回错误', () => {
  const { storage, u } = setup();
  const r = sched.applyResult(storage, u.user_id, 99, true, Date.now());
  assert.equal(r.ok, false);
});

test('getDue 只返回到期字，按仓库优先级排序', () => {
  const { storage, u } = setup();
  const t = Date.now();
  sched.startLearning(storage, u.user_id, 1, t); // W1 当天到期
  sched.initialKnown(storage, u.user_id, 2, t); // W4 +30 未到期
  const due = sched.getDue(storage, u.user_id, t);
  assert.deepEqual(due.map((p) => p.char_id), [1]);
});

test('skillLevel = 第四仓库字数', () => {
  const { storage, u } = setup();
  sched.initialKnown(storage, u.user_id, 1, Date.now());
  sched.startLearning(storage, u.user_id, 2, Date.now());
  assert.equal(sched.skillLevel(storage, u.user_id), 1);
});

test('warehouseCounts 统计正确', () => {
  const { storage, u } = setup();
  sched.initialKnown(storage, u.user_id, 1, Date.now());
  sched.startLearning(storage, u.user_id, 2, Date.now());
  const c = sched.warehouseCounts(storage, u.user_id);
  assert.deepEqual(c, { 1: 1, 2: 0, 3: 0, 4: 1 });
});
