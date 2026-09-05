'use strict';
/**
 * 集成验证：全量字库 + 混合生成器
 * 模拟用户学习过程，确认能看到词语/短语/句子，而不是一直单字。
 */
const path = require('path');
const { createMemoryStorage } = require('../src/core/storage');
const { createAppCore } = require('../src/core/index');
const { loadPack } = require('../src/core/content');

const packDir = path.join(__dirname, '..', 'src', 'assets', 'content', 'full');
const pack = loadPack(packDir);

const storage = createMemoryStorage();
const core = createAppCore(storage, pack);
const u = core.createUser({ nickname: '测试娃' });

console.log('=== 模拟学习过程（一直点认识）===\n');

const typeCounts = { char: 0, word: 0, phrase: 0, sentence: 0 };
const sampleTexts = [];

for (let round = 0; round < 60; round++) {
  const s = core.getSession(u.user_id);
  if (!s.newItems || s.newItems.length === 0) break;

  // 收集这批所有字的 char_id，全部标记认识
  const answers = [];
  for (const item of s.newItems) {
    if (item.chars && item.chars.length > 0) {
      for (const ch of item.chars) {
        if (ch.char_id) answers.push({ charId: ch.char_id, known: true });
      }
    }
  }
  if (answers.length === 0) {
    const ch = s.newItems[0] && s.newItems[0].chars && s.newItems[0].chars[0];
    if (ch && ch.char_id) answers.push({ charId: ch.char_id, known: true });
  }

  // 记录这批的内容类型
  for (const item of s.newItems) {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    if (sampleTexts.length < 30 && item.text && item.text.length > 1) {
      sampleTexts.push(`[${item.type}] ${item.text}`);
    }
  }

  core.submitSession(u.user_id, answers);

  if (round % 10 === 0) {
    const lv = core.getLevel(u.user_id);
    const learned = storage.allProgress(u.user_id).filter(p => p.warehouse >= 1).length;
    console.log(`第${round}轮：载体=${s.carrier}, 年级=${lv.grade}, 已学${learned}字, 类型分布=${JSON.stringify(typeCounts)}`);
  }
}

console.log('\n=== 最终统计 ===');
console.log('内容类型分布：', typeCounts);
const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);
const nonChar = total - (typeCounts.char || 0);
console.log(`非单字内容占比：${(nonChar / total * 100).toFixed(1)}% (${nonChar}/${total})`);

console.log('\n=== 生成的词语/句子样例 ===');
for (const t of sampleTexts.slice(0, 20)) {
  console.log('  ' + t);
}

if (nonChar > 0) {
  console.log('\n✅ 验证通过：学习过程中能看到词语/短语/句子');
} else {
  console.log('\n❌ 验证失败：一直是单字');
  process.exit(1);
}
