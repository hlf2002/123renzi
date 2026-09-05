const fs = require('fs');

// 读取组词数据
const wordsData = JSON.parse(fs.readFileSync('/tmp/gj-words-batch1.json', 'utf8'));
console.log('读取到', Object.keys(wordsData).length, '个字的组词');

// 读取char-teacher.js
let content = fs.readFileSync('src/core/char-teacher.js', 'utf8');

// 找到FALLBACK_WORDS的结束位置（};）
const fallbackMatch = content.match(/(const FALLBACK_WORDS = \{[\s\S]*?)\n\};/);
if (!fallbackMatch) {
  console.log('未找到FALLBACK_WORDS');
  process.exit(1);
}

// 构建新增的组词字符串
let additions = '';
let count = 0;
Object.keys(wordsData).forEach(char => {
  // 检查是否已存在
  if (fallbackMatch[1].includes(`'${char}':`)) {
    console.log('已存在:', char);
    return;
  }
  const words = wordsData[char].map(w => `'${w}'`).join(', ');
  additions += `  '${char}': [${words}],\n`;
  count++;
});

// 在FALLBACK_WORDS结束前插入
const newContent = content.replace(
  /(const FALLBACK_WORDS = \{[\s\S]*?)\n\};/,
  `$1\n${additions}};`
);

fs.writeFileSync('src/core/char-teacher.js', newContent, 'utf8');
console.log('已添加', count, '个字的组词到FALLBACK_WORDS');
