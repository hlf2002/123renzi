'use strict';
/**
 * 集成验证：全量字库 + 正确率驱动跳级
 * 模拟用户一直点"认识"，验证：
 * 1. band 会提升（跳级）
 * 2. 能取到更高年级的字
 * 3. 年级/百分位显示随学习进度变化
 */
const path = require('path');
const { createMemoryStorage } = require('../src/core/storage');
const { createAppCore } = require('../src/core/index');
const { loadPack } = require('../src/core/content');

const packDir = path.join(__dirname, '..', 'src', 'assets', 'content', 'full');
const pack = loadPack(packDir);
console.log(`字库加载：${pack.chars.length} 字，${pack.pool.length} 词句`);

const storage = createMemoryStorage();
const core = createAppCore(storage, pack);
const u = core.createUser({ nickname: '测试娃' });

function learnedCount() {
  return storage.allProgress(u.user_id).filter(p => p.warehouse >= 1).length;
}

console.log('\n=== 初始状态 ===');
let view = core.getLevel(u.user_id);
console.log(`band=${view.band}, 年级=${view.grade}, 百分位=${view.percentile}%, 已学=${learnedCount()}字`);

console.log('\n=== 模拟一直点"认识"（每批全对）===');
let lastBand = 0;
let jumpCount = 0;
const gradesSeen = new Set([view.grade]);

for (let round = 0; round < 120; round++) {
  const s = core.getSession(u.user_id);
  if (!s.newItems || s.newItems.length === 0) {
    console.log(`第${round}轮：无新字，结束`);
    break;
  }
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
  if (answers.length === 0) {
    console.log(`第${round}轮：无法提取 char_id，跳过`);
    continue;
  }
  core.submitSession(u.user_id, answers);

  view = core.getLevel(u.user_id);
  gradesSeen.add(view.grade);

  if (view.band !== lastBand) {
    console.log(`第${round}轮：跳级！band ${lastBand}→${view.band}, 年级=${view.grade}, 百分位=${view.percentile}%, 已学=${learnedCount()}字, 正确率=${Math.round(view.recent_accuracy * 100)}%`);
    lastBand = view.band;
    jumpCount++;
  }
}

console.log(`\n=== 最终状态 ===`);
view = core.getLevel(u.user_id);
console.log(`band=${view.band}, 年级=${view.grade}, 百分位=${view.percentile}%, 已学=${learnedCount()}字`);
console.log(`跳级次数：${jumpCount}`);
console.log(`经历过的年级：${[...gradesSeen].join(' → ')}`);
console.log(`字库总字数：${pack.chars.length}`);

if (view.grade !== '幼小衔接' && view.grade !== '一年级') {
  console.log('\n✅ 验证通过：持续全对学习后年级已提升');
} else {
  console.log('\n❌ 验证失败：年级未提升');
  process.exit(1);
}
