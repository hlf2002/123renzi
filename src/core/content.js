'use strict';
/**
 * 内容包加载 + 载体判定 + 组词/组句。
 * 依据策划案 2.3（载体演进）与 3.5（组词/组句规则）。
 */

const fs = require('fs');
const path = require('path');

// 载体类型权重：可选条目的 type 权重不得超过当前载体
const TYPE_WEIGHT = { char: 1, word: 2, phrase: 3, sentence: 4 };

// 载体阶段阈值（已确认：<100 / 100~500 / 500~1200 / 1200+）
function carrierFor(skillLevel) {
  if (skillLevel < 100) return 'char';
  if (skillLevel < 500) return 'word';
  if (skillLevel < 1200) return 'phrase';
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
function pickItems(pool, known, test, maxType, count, rng = Math.random) {
  const maxW = TYPE_WEIGHT[maxType] || 4;
  const candidates = pool.filter((e) => {
    if (TYPE_WEIGHT[e.type] > maxW) return false;
    return e.chars.every((h) => known.has(h) || test.has(h));
  });
  const withTest = candidates.filter((e) => e.chars.some((h) => test.has(h)));
  const base = withTest.length > 0 ? withTest : candidates;
  return shuffle(base, rng).slice(0, count);
}

// 是否需要载体类型兜底：maxType 下无候选时逐级放宽
function pickItemsWithFallback(pool, known, test, maxType, count, rng) {
  const order = ['char', 'word', 'phrase', 'sentence'];
  let idx = order.indexOf(maxType);
  if (idx < 0) idx = 0;
  for (let i = idx; i >= 0; i--) {
    const items = pickItems(pool, known, test, order[i], count, rng);
    if (items.length > 0) return { items, actualType: order[i] };
  }
  return { items: [], actualType: null };
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
