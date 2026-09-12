// 语音识别结果与目标文本的匹配逻辑（纯函数，可单测）
// 思路：目标文本与识别文本都转成"去声调拼音序列"（同音字天然归一），
// 用两种度量取更宽容者：
//  1) 编辑距离归一化相似度  —— 容忍同音替换
//  2) LCS 子序列覆盖度      —— 容忍漏读个别字、多读几个字
// 单字目标：识别结果里出现该读音即判对（同音容错，如"瀑"→"铺"）
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

/** 编辑距离归一化相似度（0~1） */
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

/** LCS（最长公共子序列）长度 */
export function lcsLen(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * 判断朗读是否正确
 * @param {string} targetText 目标文本（句子/词语/字）
 * @param {string} hypText 语音识别出的文本
 * @returns {boolean}
 */
export function isCorrect(targetText, hypText) {
  const t = toPinyinSeq(targetText);
  const h = toPinyinSeq(hypText);
  if (t.length === 0) return false;
  // 单字：识别结果里出现该读音即算对（同音字容错）
  if (t.length === 1) return h.includes(t[0]);

  const editSim = seqSim(t, h);
  const lcsCover = lcsLen(t, h) / t.length;
  const score = Math.max(editSim, lcsCover);

  // 目标越短，对完美程度要求越高；句子长一点更宽容（允许漏几个字）
  let threshold = 0.6;
  if (t.length <= 4) threshold = 0.55;
  if (t.length >= 9) threshold = 0.55;
  return score >= threshold;
}

/** 调试用：返回匹配明细 */
export function matchDetail(targetText, hypText) {
  const t = toPinyinSeq(targetText);
  const h = toPinyinSeq(hypText);
  return {
    target: t,
    hyp: h,
    editSim: t.length && h.length ? seqSim(t, h) : 0,
    lcsCover: t.length ? lcsLen(t, h) / t.length : 0,
    pass: isCorrect(targetText, hypText),
  };
}
