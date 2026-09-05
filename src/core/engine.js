'use strict';
/**
 * 持续评估引擎（无独立摸底）。
 * 依据策划案 3.6：每次作答即评估；基于最近答题窗口的正确率自动跳级/降级，
 * 不用学完当前年级——正确率高就直接学更难的字，正确率低就回退。
 * band（难度段 0~11，每段 300 字）决定解锁的学习区间。
 */

const { skillLevel: skillLevelFromStore } = require('./scheduler');
const {
  levelWithPercentile,
  gradeFromCharGrade,
  gradeOrder,
  nextGradeOf,
  percentileFromProgress,
  percentileFromAccuracyAndSkill,
} = require('./levels');

const WINDOW = 20;         // 正确率滑动窗口（最近20题）
const MIN_ASSESS = 10;     // 至少答10题才评估跳级/降级（避免刚开始就跳）
const JUMP_ACCURACY = 0.85; // 最近窗口正确率 ≥85% → 跳级（学更难的字）
const DEMOTE_ACCURACY = 0.5; // 最近窗口正确率 ≤50% → 降级（回学更简单的字）
const BANDS = 12;          // 12 个难度段

function ensureLevel(storage, userId, now = Date.now()) {
  let lv = storage.getLevel(userId);
  if (!lv) {
    lv = {
      user_id: userId,
      assessed_chars: 0,
      skill_level: 0,
      grade_est: '幼小衔接',
      percentile: 1,
      recent_accuracy: 1,
      streak_full: 0,
      streak_wrong: 0,
      band: 0,
      recent: [],
      last_assessed_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    };
    storage.setLevel(userId, lv);
  }
  return lv;
}

/**
 * 记录一次作答（单字粒度，兼容旧调用）。委托给 recordBatch。
 * @returns {{level: object, events: Array<{type:'jump'|'demote'}>}}
 */
function recordAnswer(storage, userId, known, now = Date.now()) {
  return recordBatch(storage, userId, [{ known: !!known }], now);
}

/**
 * 按“批”评估：基于最近答题窗口的正确率自动跳级/降级。
 * 不用学完当前年级——正确率≥85%就直接学更难的字，≤50%就回退。
 * 跳级/降级后重置窗口，形成冷却（必须再积累 MIN_ASSESS 题才重新评估）。
 */
function recordBatch(storage, userId, results, now = Date.now()) {
  const lv = ensureLevel(storage, userId, now);
  const arr = Array.isArray(results) ? results : [results];
  const answers = arr.filter((r) => r != null).map((r) => (typeof r === 'object' ? !!r.known : !!r));

  // streak（保留用于展示，不再驱动跳级）
  if (answers.length > 0) {
    const allCorrect = answers.every(Boolean);
    if (allCorrect) { lv.streak_full += 1; lv.streak_wrong = 0; }
    else { lv.streak_wrong += 1; lv.streak_full = 0; }
  }
  // 正确率窗口
  for (const k of answers) {
    lv.recent.push(k ? 1 : 0);
    if (lv.recent.length > WINDOW) lv.recent.shift();
  }
  lv.assessed_chars = (lv.assessed_chars || 0) + answers.length; // 累计答题数
  const correct = lv.recent.filter(Boolean).length;
  lv.recent_accuracy = lv.recent.length ? correct / lv.recent.length : 1;

  lv.skill_level = skillLevelFromStore(storage, userId);
  const lp = levelWithPercentile(lv.skill_level);
  lv.grade_est = lp.grade;
  lv.percentile = percentileFromAccuracyAndSkill(lv.recent_accuracy, lv.skill_level, lv.assessed_chars);

  // 基于正确率的跳级/降级（不用学完当前年级）
  const events = [];
  if (lv.recent.length >= MIN_ASSESS) {
    if (lv.recent_accuracy >= JUMP_ACCURACY && lv.band < BANDS - 1) {
      events.push({ type: 'jump', band: lv.band, accuracy: lv.recent_accuracy });
      lv.band += 1;
      lv.recent = [];       // 重置窗口，形成冷却
      lv.streak_full = 0;
    } else if (lv.recent_accuracy <= DEMOTE_ACCURACY && lv.band > 0) {
      events.push({ type: 'demote', band: lv.band, accuracy: lv.recent_accuracy });
      lv.band = Math.max(0, lv.band - 1);
      lv.recent = [];
      lv.streak_wrong = 0;
    }
  }
  lv.updated_at = new Date(now).toISOString();
  storage.setLevel(userId, lv);
  return { level: { ...lv, recent: undefined }, events };
}

/** 当前 band 对应的 study_order 区间（1 起） */
function bandRange(band) {
  const b = Math.max(0, Math.min(BANDS - 1, band));
  return [b * 300 + 1, (b + 1) * 300];
}

/** 对外水平视图（激励展示）——年级与百分位基于字库实际年级和学习进度，而非全量3500字硬编码 */
function getLevelView(storage, userId, now = Date.now()) {
  const lv = ensureLevel(storage, userId, now);
  lv.skill_level = skillLevelFromStore(storage, userId);

  // 统计用户已学字的年级分布，取最高年级作为当前水平
  const progress = storage.allProgress(userId);
  const learnedByGrade = {};
  let maxGL = null;
  for (const p of progress) {
    const c = storage.getChar(p.char_id);
    if (!c) continue;
    const gl = c.grade_level || 'g1';
    learnedByGrade[gl] = (learnedByGrade[gl] || 0) + 1;
    if (!maxGL || gradeOrder(gl) > gradeOrder(maxGL)) maxGL = gl;
  }

  // 字库各年级总字数
  const totalByGrade = {};
  for (const c of storage.allChars()) {
    const gl = c.grade_level || 'g1';
    totalByGrade[gl] = (totalByGrade[gl] || 0) + 1;
  }

  const currentGL = maxGL || 'g1';
  const grade = maxGL ? gradeFromCharGrade(maxGL) : '幼小衔接';
  // 综合百分位：正确率(65%) + 识字量(35%)，不再只看当前年级进度
  const percentile = percentileFromAccuracyAndSkill(lv.recent_accuracy, lv.skill_level, lv.assessed_chars);

  return {
    skill_level: lv.skill_level,
    grade,
    next_grade: nextGradeOf(currentGL),
    percentile,
    band: lv.band,
    recent_accuracy: Math.round(lv.recent_accuracy * 100) / 100,
    note: '参照同龄学习进度估算',
    updated_at: lv.updated_at,
  };
}

module.exports = {
  WINDOW,
  MIN_ASSESS,
  JUMP_ACCURACY,
  DEMOTE_ACCURACY,
  BANDS,
  ensureLevel,
  recordAnswer,
  recordBatch,
  bandRange,
  getLevelView,
};
