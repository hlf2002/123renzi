'use strict';
/**
 * 内容包加载 + 载体判定 + 组词/组句。
 * 依据策划案 2.3（载体演进）与 3.5（组词/组句规则）。
 */

const fs = require('fs');
const path = require('path');

// 载体类型权重：可选条目的 type 权重不得超过当前载体
const TYPE_WEIGHT = { char: 1, word: 2, phrase: 3, sentence: 4 };

// 载体阶段阈值：<5纯单字 / 5~20双字词 / 20~50短语 / 50+句子
// （年级≥二年级时由 index.js 强制升级为 sentence，此处为基础阈值）
function carrierFor(skillLevel) {
  if (skillLevel < 5) return 'char';
  if (skillLevel < 20) return 'word';
  if (skillLevel < 50) return 'phrase';
  return 'sentence';
}

/**
 * 加载内容包目录（chars.json + words.json）
 * @param {string} packDir
 * @returns {{chars: Array, pool: Array, packName: string}}
 */
function loadPack(packDir) {
  const charsFile = path.join(packDir, 'chars.json');
  const wordsFile = path.join(packDir, 'words.json');
  const chars = JSON.parse(fs.readFileSync(charsFile, 'utf8'));
  const raw = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
  const pool = raw.map((e, i) => {
    const charsArr = Array.isArray(e.chars) ? e.chars : Array.from(e.text).filter((c) => c.trim() !== '');
    return {
      content_id: i + 1,
      text: e.text,
      type: TYPE_WEIGHT[e.type] ? e.type : typeOfText(charsArr.length),
      chars: charsArr,
      pack: e.pack || path.basename(packDir),
    };
  });
  return { chars, pool, packName: path.basename(packDir) };
}

function typeOfText(len) {
  if (len <= 1) return 'char';
  if (len <= 2) return 'word';
  if (len <= 5) return 'phrase';
  return 'sentence';
}

/**
 * 从词句库挑选可用条目：
 *  - 所有组成字 ∈（已掌握 ∪ 本次待测）
 *  - type 权重不超过当前载体
 *  - 优先包含待测字的条目
 * @param {Array} pool
 * @param {Set<string>} known 已掌握字集合
 * @param {Set<string>} test 本次待测字集合
 * @param {string} maxType 当前载体
 * @param {number} count 数量
 * @param {function} [rng] 随机源（测试注入）
 * @returns {Array}
 */
/**
 * 从词句库挑选可用条目。
 * @param {Array} pool
 * @param {Set<string>} known 已掌握字集合
 * @param {Set<string>} test 本次待测字集合
 * @param {string} maxType 当前载体上限
 * @param {number} count 数量
 * @param {function} [rng] 随机源
 * @param {number} [maxExtra=0] 允许的超纲字数量
 * @param {string} [minType='char'] 载体下限（只返回type>=minType的条目）
 * @returns {Array}
 */
function pickItems(pool, known, test, maxType, count, rng = Math.random, maxExtra = 0, minType = 'char') {
  const maxW = TYPE_WEIGHT[maxType] || 4;
  const minW = TYPE_WEIGHT[minType] || 1;
  const candidates = pool.filter((e) => {
    const w = TYPE_WEIGHT[e.type] || 1;
    if (w > maxW || w < minW) return false;
    const extra = e.chars.filter((h) => !known.has(h) && !test.has(h)).length;
    return extra <= maxExtra;
  });
  // 只允许包含待测字的条目：否则新字永远进不了学习流程
  const withTest = candidates.filter((e) => e.chars.some((h) => test.has(h)));
  if (withTest.length === 0) return [];
  return shuffle(withTest, rng).slice(0, count);
}

// 是否需要载体类型兜底：优先在当前载体级别找（严格→宽松），找不到再逐级放宽
function pickItemsWithFallback(pool, known, test, maxType, count, rng) {
  const order = ['char', 'word', 'phrase', 'sentence'];
  let idx = order.indexOf(maxType);
  if (idx < 0) idx = 0;

  // 从最高级别到最低级别，每个级别都先严格再宽松（允许最多8个超纲字）
  for (let i = idx; i >= 0; i--) {
    for (const extra of [0, 8]) {
      const items = pickItems(pool, known, test, order[i], count, rng, extra, order[i]);
      if (items.length > 0) return { items, actualType: order[i], loose: extra > 0 };
    }
  }
  return { items: [], actualType: null, loose: false };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { TYPE_WEIGHT, carrierFor, loadPack, pickItems, pickItemsWithFallback, typeOfText, shuffle };
