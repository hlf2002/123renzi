'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { carrierFor, pickItems, pickItemsWithFallback } = require('../src/core/content');

test('carrierFor 载体阶段阈值', () => {
  assert.equal(carrierFor(0), 'char');
  assert.equal(carrierFor(9), 'char');
  assert.equal(carrierFor(10), 'word');
  assert.equal(carrierFor(59), 'word');
  assert.equal(carrierFor(60), 'phrase');
  assert.equal(carrierFor(149), 'phrase');
  assert.equal(carrierFor(150), 'sentence');
  assert.equal(carrierFor(3500), 'sentence');
});

test('pickItems 只用 known∪test 内的字', () => {
  const pool = [
    { text: '妈妈', type: 'word', chars: ['妈', '妈'] },
    { text: '天地', type: 'word', chars: ['天', '地'] },
    { text: '山上有花', type: 'phrase', chars: ['山', '上', '有', '花'] },
  ];
  const known = new Set(['天', '地', '山', '上', '有']);
  const test = new Set(['花']);
  const items = pickItems(pool, known, test, 'phrase', 10, () => 0.5);
  // 返回的每条目，所有字必须属于 known∪test
  for (const item of items) {
    assert.ok(item.chars.every((h) => known.has(h) || test.has(h)), `条目 ${item.text} 含未知字`);
  }
  const texts = items.map((i) => i.text);
  assert.ok(!texts.includes('妈妈'), '字不在 known∪test 的条目不可用');
  assert.ok(texts.includes('山上有花'), '含待测字的条目被优先选中');
});

test('pickItems 优先包含待测字的条目', () => {
  const pool = [
    { text: '天地', type: 'word', chars: ['天', '地'] },
    { text: '山花', type: 'word', chars: ['山', '花'] },
  ];
  const known = new Set(['天', '地', '山']);
  const test = new Set(['花']);
  const items = pickItems(pool, known, test, 'word', 1, () => 0.99);
  assert.equal(items[0].text, '山花', '优先选含待测字(花)的条目');
});

test('pickItems 超出载体级别的条目被排除', () => {
  const pool = [
    { text: '我来了', type: 'sentence', chars: ['我', '来', '了'] },
    { text: '小鸟', type: 'word', chars: ['小', '鸟'] },
  ];
  const known = new Set(['我', '来', '了', '小', '鸟']);
  const test = new Set(['我']);
  const items = pickItems(pool, known, test, 'word', 10, () => 0.5);
  assert.ok(!items.some((i) => i.type === 'sentence'), 'word 载体下不出现 sentence');
});

test('pickItemsWithFallback：载体合法时命中，类型超限时空', () => {
  const pool = [{ text: '天地', type: 'word', chars: ['天', '地'] }];
  const known = new Set(['天', '地']);
  const test = new Set(['天']);
  // 请求 phrase 时 word 条目合法 → 命中
  const r1 = pickItemsWithFallback(pool, known, test, 'phrase', 2, () => 0.5);
  assert.equal(r1.items.length, 1);
  // 请求 char 时 word 权重超限 → 无候选
  const r2 = pickItemsWithFallback(pool, known, test, 'char', 2, () => 0.5);
  assert.equal(r2.items.length, 0);
});

test('pickItems 无可用条目返回空', () => {
  const pool = [{ text: '妈妈', type: 'word', chars: ['妈', '妈'] }];
  const known = new Set(['天']);
  const test = new Set(['地']);
  const items = pickItems(pool, known, test, 'word', 3, () => 0.5);
  assert.equal(items.length, 0);
});
