const fs = require('fs');

// 读取add-g6-sentences.js中的g6Words
const addScript = fs.readFileSync('tools/add-g6-sentences.js', 'utf8');
const match = addScript.match(/const g6Words = \{([\s\S]*?)\n\};/);
if (!match) {
  console.log('未找到g6Words');
  process.exit(1);
}

// 解析g6Words
const g6Words = {};
const lines = match[1].split('\n');
lines.forEach(line => {
  const m = line.match(/'([^']+)':\s*\[([^\]]*)\]/);
  if (m) {
    const char = m[1];
    const words = m[2].match(/'([^']+)'/g)?.map(w => w.replace(/'/g, '')) || [];
    g6Words[char] = words;
  }
});

console.log('解析到', Object.keys(g6Words).length, '个字的组词');

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
Object.keys(g6Words).forEach(char => {
  // 检查是否已存在
  if (fallbackMatch[1].includes(`'${char}':`)) {
    console.log('已存在:', char);
    return;
  }
  const words = g6Words[char].map(w => `'${w}'`).join(', ');
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
