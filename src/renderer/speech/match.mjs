// 语音识别结果与目标文本的匹配逻辑（纯函数，可单测）
// 思路：目标文本与识别文本都转成"去声调拼音序列"（同音字天然归一）。
// 匹配规则（用户确认）：
//  - 不可以漏字：目标每个字必须按序在识别结果里找到匹配
//  - 同音字可以过（拼音相同）
//  - 近音字也可以过：覆盖语音识别最常见的声学混淆
//    （前后鼻音 in/ing、an/ang、平翘舌、ao/ou 等），
//    解决"蹂躏"被听成"饶命"这类小模型误识别
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

/** 声母表（按最长优先匹配切分） */
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];

/** 切分拼音 → { initial, final }，零声母 initial 为 '' */
function splitPinyin(py) {
  for (const ini of INITIALS) {
    if (py.startsWith(ini)) return { initial: ini, final: py.slice(ini.length) };
  }
  return { initial: '', final: py };
}

/** 声母近音组：语音识别/儿童发音常见混淆 */
const INITIAL_GROUPS = [
  ['m', 'n', 'l'], // 鼻音/边音
  ['z', 'c', 's', 'zh', 'ch', 'sh'], // 平翘舌
  ['f', 'h'], // 唇齿/喉
];

function initialNear(a, b) {
  if (a === b) return true;
  for (const g of INITIAL_GROUPS) {
    if (g.includes(a) && g.includes(b)) return true;
  }
  return false;
}

/** 韵母近音：前后鼻音互近、前响复韵母（ai/ei/ao/ou）互近 */
const FRONT_NASAL = ['an', 'ian', 'uan', 'üan', 'en', 'in', 'un', 'ün'];
const BACK_NASAL = ['ang', 'iang', 'uang', 'eng', 'ing', 'ueng', 'ong', 'iong'];
const DIPHTHONG = ['ai', 'ei', 'ao', 'ou']; // 前响复韵母

function finalNear(a, b) {
  if (a === b) return true;
  if (FRONT_NASAL.includes(a) && BACK_NASAL.includes(b)) return true;
  if (BACK_NASAL.includes(a) && FRONT_NASAL.includes(b)) return true;
  if (DIPHTHONG.includes(a) && DIPHTHONG.includes(b)) return true;
  return false;
}

/**
 * 单字拼音是否匹配：同音，或 声母近 + 韵母近
 * 例：rou vs rao → r 同、ou/ao 近 → 匹配（蹂→饶）
 *    lin vs ming → l/m 鼻音组近、in/ing 前后鼻音近 → 匹配（躏→命）
 */
function charMatch(t, h) {
  if (t === h) return true;
  const ti = splitPinyin(t);
  const hi = splitPinyin(h);
  return initialNear(ti.initial, hi.initial) && finalNear(ti.final, hi.final);
}

/**
 * 判断朗读是否正确
 * 规则：不可以漏字，同音/近音可以过。
 * 目标每个字必须按序在识别结果里找到（同音或近音）匹配。
 * @param {string} targetText 目标文本（句子/词语/字）
 * @param {string} hypText 语音识别出的文本
 * @returns {boolean}
 */
export function isCorrect(targetText, hypText) {
  const t = toPinyinSeq(targetText);
  const h = toPinyinSeq(hypText);
  if (t.length === 0) return false;
  // 单字：识别结果里任一字同音/近音即算对
  if (t.length === 1) return h.some((x) => charMatch(t[0], x));
  // 多字：目标每个字按序匹配（贪心），漏任何一字都不行
  let hi = 0;
  for (const tp of t) {
    let found = false;
    while (hi < h.length) {
      if (charMatch(tp, h[hi])) { found = true; hi += 1; break; }
      hi += 1;
    }
    if (!found) return false;
  }
  return true;
}

/** 调试用：返回匹配明细 */
export function matchDetail(targetText, hypText) {
  const t = toPinyinSeq(targetText);
  const h = toPinyinSeq(hypText);
  return {
    target: t,
    hyp: h,
    pass: isCorrect(targetText, hypText),
  };
}
