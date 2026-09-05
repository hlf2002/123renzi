'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const gen = require('../src/core/content-generator');

// 固定随机源，确保测试可复现
function fixedRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

test('生成的词句只包含 known∪test 的字', () => {
  const known = new Set(['大', '小', '山', '水', '的', '在', '里', '有', '是', '和']);
  const test = new Set(['花', '鸟']);
  const results = gen.generateItems(known, test, 'sentence', 10, fixedRng(42));
  assert.ok(results.length > 0, '应生成至少一条');
  for (const item of results) {
    for (const ch of item.chars) {
      assert.ok(known.has(ch) || test.has(ch), `字「${ch}」不在 known∪test 中`);
    }
  }
});

test('生成的词句必须包含至少一个 test 字', () => {
  const known = new Set(['大', '小', '山', '水', '的', '在', '里']);
  const test = new Set(['花']);
  const results = gen.generateItems(known, test, 'phrase', 10, fixedRng(123));
  assert.ok(results.length > 0);
  for (const item of results) {
    assert.ok(item.chars.includes('花'), `词句「${item.text}」未包含 test 字「花」`);
  }
});

test('不同随机种子生成不同结果', () => {
  const known = new Set(['大', '小', '山', '水', '的', '在', '里', '有', '是', '和', '我', '你', '他']);
  const test = new Set(['花', '鸟', '鱼']);
  const r1 = gen.generateItems(known, test, 'sentence', 5, fixedRng(1));
  const r2 = gen.generateItems(known, test, 'sentence', 5, fixedRng(999));
  const texts1 = r1.map((r) => r.text).join(',');
  const texts2 = r2.map((r) => r.text).join(',');
  assert.notEqual(texts1, texts2, '不同种子应生成不同结果');
});

test('known 太少时无可用模板返回空（不硬凑不通顺的词）', () => {
  const known = new Set(['大', '小']);
  const test = new Set(['山']);
  const results = gen.generateItems(known, test, 'sentence', 5, fixedRng(7));
  // 大/小模板需要 minKnown=5，known只有2字，无可用模板
  assert.equal(results.length, 0, 'known太少时应返回空，由调用方退化为单字格');
});

test('known 足够时能生成短语和句子', () => {
  const known = new Set([
    '大', '小', '山', '水', '的', '在', '里', '有', '是', '和',
    '我', '你', '他', '这', '那', '一', '个', '上', '下', '天',
    '地', '人', '口', '手', '目', '耳', '日', '月', '火', '石',
    '田', '禾', '虫', '云', '雨', '风', '马', '牛', '羊', '喜',
    '欢', '去', '吃', '喝', '看', '读', '写', '画', '飞', '游',
    '跑', '跳', '唱', '今', '起', '很',
  ]);
  const test = new Set(['花', '鸟', '鱼', '书']);
  const results = gen.generateItems(known, test, 'sentence', 20, fixedRng(2024));
  const types = new Set(results.map((r) => r.type));
  assert.ok(types.has('phrase') || types.has('sentence'), 'known 足够时应能生成短语或句子');
});

test('test 为空时返回空数组', () => {
  const known = new Set(['大', '小']);
  const results = gen.generateItems(known, new Set(), 'word', 5);
  assert.equal(results.length, 0);
});

test('maxType 限制生成类型', () => {
  const known = new Set(['大', '小', '山', '水', '的', '在', '里', '有', '是']);
  const test = new Set(['花']);
  const results = gen.generateItems(known, test, 'word', 10, fixedRng(55));
  for (const item of results) {
    assert.equal(item.type, 'word', 'maxType=word 时不应生成短语或句子');
  }
});

test('生成结果去重（不重复）', () => {
  const known = new Set(['大', '小', '山', '水', '的', '在', '里', '有', '是', '和']);
  const test = new Set(['花', '鸟', '鱼', '虫']);
  const results = gen.generateItems(known, test, 'phrase', 10, fixedRng(88));
  const texts = results.map((r) => r.text);
  assert.equal(new Set(texts).size, texts.length, '生成结果不应重复');
});

test('AI 生成器注入与回退', () => {
  const known = new Set(['大', '小', '山', '水', '的', '在', '里']);
  const test = new Set(['花']);
  // 注入一个返回无效结果的 AI 生成器（包含不在 known∪test 的字）
  gen.setAIGenerator({
    generate: async () => [{ text: '外星人', type: 'word' }],
  });
  return gen.generateItemsAsync(known, test, 'word', 3).then((results) => {
    // AI 结果无效（'外'不在 known∪test），应回退模板生成
    assert.ok(results.length > 0, 'AI 无效时应回退模板生成');
    for (const item of results) {
      for (const ch of item.chars) {
        assert.ok(known.has(ch) || test.has(ch));
      }
    }
    // 清除 AI 生成器
    gen.setAIGenerator(null);
  });
});

test('AI 生成器有效结果优先', () => {
  const known = new Set(['大', '小', '山', '水']);
  const test = new Set(['花']);
  gen.setAIGenerator({
    generate: async () => [{ text: '山花', type: 'word' }],
  });
  return gen.generateItemsAsync(known, test, 'word', 3).then((results) => {
    assert.ok(results.length > 0);
    assert.equal(results[0].text, '山花');
    gen.setAIGenerator(null);
  });
});
