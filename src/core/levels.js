'use strict';
/**
 * 年级映射 + 超越百分比（同龄人基准模型）。
 * 依据策划案 13.5-D：年级基线表 + 各年级同龄识字量正态分布假设。
 */

// 各年级累计识字量基线（策划案 13.5-D）
const GRADE_BASE = [
  { grade: '一年级', base: 700 },
  { grade: '二年级', base: 1500 },
  { grade: '三年级', base: 2000 },
  { grade: '四年级', base: 2500 },
  { grade: '五年级', base: 2800 },
  { grade: '六年级', base: 3050 },
  { grade: '初中', base: 3300 },
  { grade: '高中', base: 3500 },
];

// 正态分布 CDF（Abramowitz & Stegun 7.1.26 有理近似，误差 < 1.5e-7）
function normalCdf(x) {
  if (x < 0) return 1 - normalCdf(-x);
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - p;
}

/**
 * 由已掌握字量求当前年级水平。
 * @param {number} skillLevel 已掌握字量
 * @returns {{grade:string, next?:string, base:number}} 年级名与基线
 */
function gradeOf(skillLevel) {
  if (!Number.isFinite(skillLevel) || skillLevel < 0) skillLevel = 0;
  for (let i = GRADE_BASE.length - 1; i >= 0; i--) {
    if (skillLevel >= GRADE_BASE[i].base) {
      return { grade: GRADE_BASE[i].grade, base: GRADE_BASE[i].base, next: GRADE_BASE[i + 1] ? GRADE_BASE[i + 1].grade : null };
    }
  }
  return { grade: '幼小衔接', base: 0, next: GRADE_BASE[0].grade };
}

/**
 * 同龄人基准模型：当前年级同龄人识字量 N(base*0.6, sigma)。
 * 用"课标平均进度"假设：同年级大部分孩子处于该年级基线 60% 附近的中间态，sigma=base*0.12。
 * @param {number} skillLevel 已掌握字量
 * @returns {{grade, percentile, note}}
 */
function levelWithPercentile(skillLevel) {
  const g = gradeOf(skillLevel);
  if (g.base === 0) {
    // 未达到一年级基线：percentile 按相对一年级的进度估算
    const mu = 700 * 0.6;
    const sigma = 700 * 0.12;
    const pct = Math.round(normalCdf((skillLevel - mu) / sigma) * 100);
    return { ...g, percentile: clamp(pct, 1, 99), note: '参照同龄学习进度估算' };
  }
  const mu = g.base * 0.6; // 该年级同龄人平均水平（课标进度中间态）
  const sigma = g.base * 0.12;
  const pct = Math.round(normalCdf((skillLevel - mu) / sigma) * 100);
  return { ...g, percentile: clamp(pct, 1, 99), note: '参照同龄学习进度估算' };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// 字库 grade_level 字段 → 年级名
const GRADE_LEVEL_MAP = {
  g1: '一年级', g2: '二年级', g3: '三年级', g4: '四年级',
  g5: '五年级', g6: '六年级', gj: '初中', gh: '高中',
};
const GRADE_ORDER = { g1: 1, g2: 2, g3: 3, g4: 4, g5: 5, g6: 6, gj: 7, gh: 8 };

/** 字库 grade_level → 年级展示名 */
function gradeFromCharGrade(gl) {
  return GRADE_LEVEL_MAP[gl] || '幼小衔接';
}
/** 年级顺序（用于比较高低） */
function gradeOrder(gl) {
  return GRADE_ORDER[gl] || 0;
}
/** 下一年级名（最高年级返回 null） */
function nextGradeOf(gl) {
  const order = gradeOrder(gl);
  if (order === 0) return '一年级';
  const entry = Object.entries(GRADE_ORDER).find(([, v]) => v === order + 1);
  return entry ? GRADE_LEVEL_MAP[entry[0]] : null;
}

/**
 * 基于「当前年级字库学习进度」的同龄人百分位（保留兼容）。
 */
function percentileFromProgress(learned, total) {
  if (!Number.isFinite(total) || total <= 0) return 1;
  const mu = total * 0.6;
  const sigma = Math.max(total * 0.12, 1);
  const pct = Math.round(normalCdf((learned - mu) / sigma) * 100);
  return clamp(pct, 1, 99);
}

/**
 * 正确率 → 百分位映射。
 * 一直全对的孩子超过大部分同龄人；正确率越低百分位越低。
 */
function accuracyToPercentile(acc) {
  if (acc >= 0.98) return 92;
  if (acc >= 0.90) return 82;
  if (acc >= 0.80) return 70;
  if (acc >= 0.70) return 58;
  if (acc >= 0.60) return 45;
  if (acc >= 0.50) return 32;
  if (acc >= 0.35) return 20;
  return 10;
}

/**
 * 综合同龄人百分位：正确率(65%) + 识字量(35%)。
 * 修复旧版只看「当前年级学习进度」导致跳级后一直显示1%的问题。
 * @param {number} accuracy 最近正确率 0-1
 * @param {number} skillLevel 已学字数（W4）
 * @param {number} recentCount 最近答题数（<5题时给默认值50）
 */
function percentileFromAccuracyAndSkill(accuracy, skillLevel, recentCount) {
  if (!recentCount || recentCount < 5) return 50;
  const accPct = accuracyToPercentile(accuracy);
  // 识字量百分位：同龄人平均认识800字，sigma=400
  const mu = 800;
  const sigma = 400;
  const skillPct = Math.round(normalCdf((skillLevel - mu) / sigma) * 100);
  const combined = accPct * 0.65 + skillPct * 0.35;
  return clamp(Math.round(combined), 1, 99);
}

module.exports = {
  GRADE_BASE, GRADE_LEVEL_MAP,
  gradeOf, levelWithPercentile, normalCdf,
  gradeFromCharGrade, gradeOrder, nextGradeOf,
  percentileFromProgress, accuracyToPercentile, percentileFromAccuracyAndSkill,
};
