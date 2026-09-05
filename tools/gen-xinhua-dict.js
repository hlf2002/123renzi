#!/usr/bin/env node
/**
 * 从新华字典(16142字)中提取3500常用字的儿童友好解释。
 * - 过滤古文引文（《说文》《国语》等）
 * - 过滤"又如""例如"等扩展内容
 * - 保留最核心的1-2句白话解释
 * - 输出精简字典文件（约3500字，文件大小大幅减小）
 */
'use strict';
const fs = require('fs');
const path = require('path');

const XINHUA_PATH = '/tmp/xinhua-word.json';
const CHARS_PATH = path.join(__dirname, '..', 'src', 'assets', 'content', 'full', 'chars.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'assets', 'content', 'full', 'xinhua.json');

// 加载3500常用字
const chars = JSON.parse(fs.readFileSync(CHARS_PATH, 'utf8'));
const commonSet = new Set(chars.map(c => c.hanzi));
console.log('常用字数:', commonSet.size);

// 加载新华字典
const xinhua = JSON.parse(fs.readFileSync(XINHUA_PATH, 'utf8'));
console.log('新华字典字数:', xinhua.length);

// 从 explanation 中提取儿童友好的简化解释
function extractMeaning(explanation) {
  if (!explanation) return '';
  // 按行分割
  const lines = explanation.split('\n').map(l => l.trim()).filter(Boolean);

  // 第一步：找到"本义"后面的内容（最核心的解释）
  let coreMeaning = '';
  for (const line of lines) {
    const benyiMatch = line.match(/本义[：:，,]?(.+)/);
    if (benyiMatch) {
      coreMeaning = benyiMatch[1].trim();
      break;
    }
  }

  // 第二步：如果没有"本义"，找第一个有实际意义的解释行
  if (!coreMeaning) {
    for (const line of lines) {
      // 过滤文字学分析
      if (/^(象形|形声|会意|指事|转注|假借)/.test(line)) continue;
      if (line.includes('甲骨文字形') || line.includes('金文字形') || line.includes('小篆')) continue;
      if (line.includes('是汉字的一个部首') || line.includes('是汉字部首')) continue;
      if (line.includes('《') || line.includes('》') || line.includes('--')) continue;
      if (/^[〈<][名动形数量代副介连助叹拟声][〉>]$/.test(line)) continue;
      if (line.length < 5) continue;
      coreMeaning = line;
      break;
    }
  }

  // 第三步：清理核心解释
  if (coreMeaning) {
    // 去掉括号内的文字学说明
    coreMeaning = coreMeaning.replace(/\([^)]*(象形|形声|会意|指事|甲骨文|金文|部首|本义)[^)]*\)/g, '');
    // 去掉"同本义"（重复）
    coreMeaning = coreMeaning.replace(/同本义[。，,]?/g, '');
    // 去掉开头的词性标注
    coreMeaning = coreMeaning.replace(/^[〈<][名动形数量代副介连助叹拟声][〉>][。，,]?/, '');
    // 去掉多余的标点和空格
    coreMeaning = coreMeaning.replace(/[。，,]{2,}/g, '。').replace(/^[：:，,。\s]+/, '').trim();
    // 去掉末尾的括号和引号
    coreMeaning = coreMeaning.replace(/[)）"'」』]+$/, '').trim();
    // 去掉末尾的"的"（不完整的解释）
    if (coreMeaning.endsWith('的') && coreMeaning.length < 15) {
      coreMeaning = coreMeaning.slice(0, -1);
    }
    // 截断到80字
    if (coreMeaning.length > 80) {
      coreMeaning = coreMeaning.slice(0, 80);
      // 确保在标点处截断
      const lastPunct = Math.max(coreMeaning.lastIndexOf('。'), coreMeaning.lastIndexOf('，'), coreMeaning.lastIndexOf(','));
      if (lastPunct > 20) coreMeaning = coreMeaning.slice(0, lastPunct + 1);
    }
  }

  return coreMeaning;
}

// 提取词性（名/动/形/数/量/代/副/介/连/助/叹/拟声）
function extractPOS(explanation, more) {
  const text = (explanation || '') + '\n' + (more || '');
  const posMatch = text.match(/[〈<]([名动形数量代副介连助叹拟声])[〉>]/g);
  if (!posMatch) return '';
  // 去重
  const posSet = new Set(posMatch.map(p => p.replace(/[〈<>〉]/g, '')));
  return [...posSet].join('');
}

// 从 more 字段提取适合儿童的简单例句
function extractExamples(more, hanzi) {
  if (!more) return [];
  const lines = more.split('\n').map(l => l.trim()).filter(Boolean);
  const examples = [];
  for (const line of lines) {
    // 过滤条件：包含该字、长度5-20字、不是古文引文、不是词语解释
    if (!line.includes(hanzi)) continue;
    if (line.length < 5 || line.length > 25) continue;
    if (line.includes('--') || line.includes('《') || line.includes('》')) continue;
    if (line.includes('[') || line.includes(']')) continue;
    if (line.includes('部首') || line.includes('笔画')) continue;
    if (line.includes('又如') || line.includes('例如')) continue;
    if (/^[a-z]/i.test(line)) continue; // 跳过拼音行
    if (line.includes('(') && line.includes(')')) continue; // 跳过带括号解释的行
    examples.push(line);
    if (examples.length >= 2) break;
  }
  return examples;
}

// 提取拼音（取第一个读音）
function extractPinyin(pinyin) {
  if (!pinyin) return '';
  // 多个读音用空格或逗号分隔，取第一个
  const first = pinyin.split(/[,，\s]/)[0];
  return first || pinyin;
}

// 生成精简字典
const dict = {};
let matched = 0;
for (const item of xinhua) {
  if (!commonSet.has(item.word)) continue;
  matched++;
  const meaning = extractMeaning(item.explanation);
  if (!meaning) continue;
  const pos = extractPOS(item.explanation, item.more);
  const examples = extractExamples(item.more, item.word);
  dict[item.word] = {
    pinyin: extractPinyin(item.pinyin),
    strokes: item.strokes || 0,
    meaning,
    pos,
    examples,
  };
}

console.log('匹配到常用字:', matched);
console.log('有解释的字:', Object.keys(dict).length);

// 输出示例
console.log('\n示例:');
for (const ch of ['山', '水', '人', '学', '好', '花', '鸟', '一']) {
  if (dict[ch]) {
    console.log(`  ${ch}(${dict[ch].pinyin}): ${dict[ch].meaning}`);
  }
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dict, null, 2), 'utf8');
console.log('\n已输出:', OUTPUT_PATH);
console.log('文件大小:', (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1), 'KB');
