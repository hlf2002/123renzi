// 语音识别结果与目标文本的匹配逻辑（纯函数，可单测）
// 思路：目标文本与识别文本都转成"去声调拼音序列"，做序列相似度比对；
// 单字目标（如"瀑"）只要识别结果里出现同音字（如"铺/曝"）即判对，
// 这样能容忍语音识别把小孩子的发音识别成同音字。
import { pinyin } from 'pinyin-pro';

/**
 * 文本 → 拼音序列（去声调，只保留汉字）
 * "小猫在河边钓鱼" → ["xiao","mao","zai","he","bian","diao","yu"]
 */
export function toPinyinSeq(text) {
  if (!text) return [];
  const chars = String(text).replace(/[^\u4e00-\u9fa5]/g, '').split('');
  return chars
    .map((c) => {
      const py = pinyin(c, { toneType: 'none', type: 'array' });
      return (Array.isArray(py) && py[0]) || c;
    })
    .filter(Boolean);
}

/**
 * 两个拼音序列的归一化相似度（0~1），基于编辑距离
 * 相等 → 1；完全无关 → 0
 */
export function seqSim(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0 && n === 0) return 1;
  if (m === 0 || n === 0) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

/**
 * 判断朗读是否正确
 * @param {string} targetText 目标文本（句子/词语/字）
 * @param {string} hypText 语音识别出的文本
 * @param {number} threshold 相似度阈值（0~1），默认 0.6
 * @returns {boolean}
 */
export function isCorrect(targetText, hypText, threshold = 0.6) {
  const t = toPinyinSeq(targetText);
  const h = toPinyinSeq(hypText);
  if (t.length === 0) return false;
  if (t.length === 1) {
    // 单字：识别结果里出现该读音即算对（同音字容错）
    return h.includes(t[0]);
  }
  return seqSim(t, h) >= threshold;
}
