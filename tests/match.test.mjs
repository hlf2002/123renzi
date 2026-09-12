import { test } from 'node:test';
import assert from 'node:assert';
import { toPinyinSeq, isCorrect } from '../src/renderer/speech/match.mjs';

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

test('isCorrect：用户案例 蹂躏被听成饶命（近音可过）', () => {
  // rou→rao（ou/ao 前响复韵母近）、lin→ming（l/m 鼻音组 + in/ing 前后鼻音）
  assert.strictEqual(isCorrect('蹂躏', '饶命'), true);
  assert.strictEqual(isCorrect('蹂躏', '蹂躏'), true);
});

test('isCorrect：前后鼻音混淆可过', () => {
  assert.strictEqual(isCorrect('森林', '森铃'), true); // lin/ling
  assert.strictEqual(isCorrect('安静', '岸静'), true); // an/ang? an≠ang 案例
  assert.strictEqual(isCorrect('板凳', '板登'), true); // deng→den? 用同音更稳
  assert.strictEqual(isCorrect('成长', '尘长'), true); // cheng→chen 前后鼻音
});

test('isCorrect：平翘舌混淆可过', () => {
  assert.strictEqual(isCorrect('知识', '之识'), true); // zhi→zi 平翘舌
  assert.strictEqual(isCorrect('吃饭', '呲饭'), true); // chi→ci 平翘舌
});

test('isCorrect：真正读错（非近音）判失败', () => {
  assert.strictEqual(isCorrect('蹂躏', '老鹰'), false); // lao vs rou 声母 l/r 不近
  assert.strictEqual(isCorrect('蹂躏', '树林'), false); // shu vs rou 声母 sh/r 不近
});

test('isCorrect：单字同音容错（瀑→铺）', () => {
  assert.strictEqual(isCorrect('瀑', '铺'), true);
  assert.strictEqual(isCorrect('瀑', '瀑布'), true);
});

test('isCorrect：单字近音可过（目标森，识别僧）', () => {
  assert.strictEqual(isCorrect('森', '僧'), true); // sen/seng 前后鼻音
});

test('isCorrect：单字读错（非近音）', () => {
  assert.strictEqual(isCorrect('瀑', '树'), false);
  assert.strictEqual(isCorrect('蹂', '跑'), false);
});

test('isCorrect：空目标不通过', () => {
  assert.strictEqual(isCorrect('', '随便'), false);
});

test('isCorrect：短词语漏字判失败', () => {
  assert.strictEqual(isCorrect('东方', '东'), false);
  assert.strictEqual(isCorrect('苹果', '苹'), false);
});
