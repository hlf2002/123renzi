'use strict';
/**
 * 生成全量字库（3500常用字）
 * - 小学1-6年级：统编版教材识字表（按年级分配 g1-g6）
 * - 初中/高中补全：3500常用字表减去小学字，按字频分配 gj/gh
 *
 * 用法：node tools/gen-full-chars.js
 * 输出：src/assets/content/full/chars.json + words.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'char-data');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'content', 'full');

// ---------- 1. 读取3500常用字表（按字频顺序） ----------
const level1Raw = fs.readFileSync(path.join(DATA_DIR, 'level1.txt'), 'utf8');
const level1Chars = [...level1Raw].filter(c => /\p{Script=Han}/u.test(c));
console.log(`3500常用字表读取：${level1Chars.length} 字`);

// ---------- 2. 解析小学各年级识字表 ----------
const primaryRaw = fs.readFileSync(path.join(DATA_DIR, 'primary.txt'), 'utf8');
const lines = primaryRaw.split('\n');

// 年级映射：一年级→g1, 二年级→g2, ..., 六年级→g6
const gradeMap = { '一': 'g1', '二': 'g2', '三': 'g3', '四': 'g4', '五': 'g5', '六': 'g6' };

// 按"X年级X册生字：N个"分块
const gradeChars = { g1: [], g2: [], g3: [], g4: [], g5: [], g6: [] };
let currentGrade = null;

for (const line of lines) {
  const headerMatch = line.match(/^([一二三四五六])年级[上下]册生字/);
  if (headerMatch) {
    currentGrade = gradeMap[headerMatch[1]];
    continue;
  }
  if (currentGrade && line.trim()) {
    // 提取行中所有汉字
    const chars = [...line].filter(c => /\p{Script=Han}/u.test(c));
    for (const ch of chars) {
      if (!gradeChars[currentGrade].includes(ch)) {
        gradeChars[currentGrade].push(ch);
      }
    }
  }
}

console.log('小学各年级字数：');
for (const g of ['g1','g2','g3','g4','g5','g6']) {
  console.log(`  ${g}: ${gradeChars[g].length}`);
}

// ---------- 3. 计算补全字（3500字 - 小学字） ----------
const primarySet = new Set();
for (const g of ['g1','g2','g3','g4','g5','g6']) {
  for (const ch of gradeChars[g]) primarySet.add(ch);
}
console.log(`小学去重合计：${primarySet.size} 字`);

const supplement = level1Chars.filter(ch => !primarySet.has(ch));
console.log(`补全字（3500-小学）：${supplement.length} 字`);

// 补全字按字频分配：前50%初中(gj)，后50%高中(gh)
const mid = Math.ceil(supplement.length / 2);
const gjChars = supplement.slice(0, mid);
const ghChars = supplement.slice(mid);
console.log(`  初中(gj)补全：${gjChars.length} 字`);
console.log(`  高中(gh)补全：${ghChars.length} 字`);

// ---------- 4. 组装全量字库 ----------
const allChars = [];
let order = 1;

function addGrade(chars, gradeLevel, source) {
  for (const ch of chars) {
    // 全局去重（防止跨年级重复）
    if (allChars.some(c => c.hanzi === ch)) continue;
    allChars.push({
      hanzi: ch,
      pinyin: '',
      stroke_count: 0,
      study_order: order++,
      grade_level: gradeLevel,
      source: source,
      content_pack: 'full'
    });
  }
}

// 按年级顺序：g1→g2→g3→g4→g5→g6→gj→gh
addGrade(gradeChars.g1, 'g1', 'tongbian');
addGrade(gradeChars.g2, 'g2', 'tongbian');
addGrade(gradeChars.g3, 'g3', 'tongbian');
addGrade(gradeChars.g4, 'g4', 'tongbian');
addGrade(gradeChars.g5, 'g5', 'tongbian');
addGrade(gradeChars.g6, 'g6', 'tongbian');
addGrade(gjChars, 'gj', 'level1_freq');
addGrade(ghChars, 'gh', 'level1_freq');

console.log(`\n全量字库合计：${allChars.length} 字`);

// 按年级统计
const byGrade = {};
for (const c of allChars) {
  byGrade[c.grade_level] = (byGrade[c.grade_level] || 0) + 1;
}
console.log('各年级最终字数：', byGrade);

// ---------- 5. 写入文件 ----------
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'chars.json'), JSON.stringify(allChars, null, 2), 'utf8');
// words.json 先放空数组（buildItems 有单字格兜底，后续可补充词句）
fs.writeFileSync(path.join(OUT_DIR, 'words.json'), '[]', 'utf8');

console.log(`\n已生成：${path.join(OUT_DIR, 'chars.json')}`);
console.log(`已生成：${path.join(OUT_DIR, 'words.json')}`);
