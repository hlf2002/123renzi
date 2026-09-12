import { test } from 'node:test';
import assert from 'node:assert';
import { toPinyinSeq, seqSim, lcsLen, isCorrect } from '../src/renderer/speech/match.mjs';

test('toPinyinSeq：正常句子', () => {
  assert.deepStrictEqual(toPinyinSeq('小猫在河边钓鱼'), ['xiao', 'mao', 'zai', 'he', 'bian', 'diao', 'yu']);
});

test('toPinyinSeq：带标点符号被过滤', () => {
  assert.deepStrictEqual(toPinyinSeq('小猫，在河边！'), ['xiao', 'mao', 'zai', 'he', 'bian']);
});

test('toPinyinSeq：空输入', () => {
  assert.deepStrictEqual(toPinyinSeq(''), []);
  assert.deepStrictEqual(toPinyinSeq(null), []);
});

test('seqSim：完全相同=1', () => {
  const a = ['xiao', 'mao', 'zai'];
  assert.strictEqual(seqSim(a, [...a]), 1);
});

test('seqSim：完全无关=0', () => {
  assert.strictEqual(seqSim(['xiao'], ['da']), 0);
});

test('lcsLen：公共子序列', () => {
  assert.strictEqual(lcsLen(['xiao', 'mao', 'zai'], ['xiao', 'zai']), 2);
  assert.strictEqual(lcsLen(['a', 'b', 'c'], ['b', 'c', 'a']), 2); // b,c
});

test('isCorrect：整句读对', () => {
  assert.strictEqual(isCorrect('小猫在河边钓鱼', '小猫在河边钓鱼'), true);
});

test('isCorrect：同音错字可过（河→喝）', () => {
  assert.strictEqual(isCorrect('小猫在河边钓鱼', '小猫在喝边钓鱼'), true);
});

test('isCorrect：不可以漏字（末尾漏字）', () => {
  assert.strictEqual(isCorrect('小猫在河边钓鱼', '小猫在河边钓'), false);
});

test('isCorrect：不可以漏字（中间漏字）', () => {
  assert.strictEqual(isCorrect('小猫在河边钓鱼', '小猫河边钓鱼'), false);
});

test('isCorrect：多读几个字仍通过', () => {
  assert.strictEqual(isCorrect('小猫在河边钓鱼', '小猫在河边钓鱼鱼'), true);
});

test('isCorrect：读错较多判失败', () => {
  assert.strictEqual(isCorrect('小猫在河边钓鱼', '大树上有鸟'), false);
});

test('isCorrect：单字同音容错（瀑→铺）', () => {
  assert.strictEqual(isCorrect('瀑', '铺'), true);
  assert.strictEqual(isCorrect('瀑', '瀑布'), true);
});

test('isCorrect：单字读错', () => {
  assert.strictEqual(isCorrect('瀑', '树'), false);
});

test('isCorrect：空目标不通过', () => {
  assert.strictEqual(isCorrect('', '随便'), false);
});

test('isCorrect：短词语漏字判失败、同音可过', () => {
  assert.strictEqual(isCorrect('东方', '东'), false);
  assert.strictEqual(isCorrect('苹果', '苹'), false);
  assert.strictEqual(isCorrect('苹果', '平果'), true); // 同音替换
  assert.strictEqual(isCorrect('东方', '东方'), true);
});
