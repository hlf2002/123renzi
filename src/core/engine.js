'use strict';
/**
 * 持续评估引擎（无独立摸底）。
 * 依据策划案 3.6：每次作答即评估；连续 5 次全对跳级、连续 3 次答错降级；
 * band（难度段 0~11，每段 300 字）决定解锁的学习区间。
 */

const { skillLevel: skillLevelFromStore } = require('./scheduler');
const {
  levelWithPercentile,
  gradeFromCharGrade,
  gradeOrder,
  nextGradeOf,
  percentileFromProgress,
} = require('./levels');

const JUMP_STREAK = 5;   // 连续全对次数 → 跳级
const DEMOTE_STREAK = 3; // 连续答错次数 → 降级
const WINDOW = 20;       // 正确率滑动窗口
const BANDS = 12;        // 12 个难度段

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
 * 记录一次作答，更新水平估计与跳级/降级事件。
 * @returns {{level: object, events: Array<{type:'jump'|'demote'}>}}
 */
function recordAnswer(storage, userId, known, now = Date.now()) {
  const lv = ensureLevel(storage, userId, now);
  lv.recent.push(known ? 1 : 0);
  if (lv.recent.length > WINDOW) lv.recent.shift();
  const correct = lv.recent.filter(Boolean).length;
  lv.recent_accuracy = lv.recent.length ? correct / lv.recent.length : 1;

  if (known) { lv.streak_full += 1; lv.streak_wrong = 0; }
  else { lv.streak_wrong += 1; lv.streak_full = 0; }

  lv.skill_level = skillLevelFromStore(storage, userId);
  const lp = levelWithPercentile(lv.skill_level);
  lv.grade_est = lp.grade;
  lv.percentile = lp.percentile;

  const events = [];
  if (lv.streak_full >= JUMP_STREAK) {
    events.push({ type: 'jump', band: lv.band });
    lv.band = Math.min(BANDS - 1, lv.band + 1);
    lv.streak_full = 0;
  }
  if (lv.streak_wrong >= DEMOTE_STREAK) {
    events.push({ type: 'demote', band: lv.band });
    lv.band = Math.max(0, lv.band - 1);
    lv.streak_wrong = 0;
  }
  lv.updated_at = new Date(now).toISOString();
  storage.setLevel(userId, lv);
  return { level: { ...lv, recent: undefined }, events };
}

/**
 * 按“批”评估（策划案：连续 5 次全对跳级，以作答批次为单位）。
 * 一批内所有作答全对才计 1 次连续全对；有任何答错则计 1 次连续答错。
 * 避免一批 5 个新字全对就瞬间跳级（旧版逐字计数的缺陷）。
 */
function recordBatch(storage, userId, results, now = Date.now()) {
  const lv = ensureLevel(storage, userId, now);
  const arr = Array.isArray(results) ? results : [results];
  const answers = arr.filter((r) => r != null).map((r) => (typeof r === 'object' ? !!r.known : !!r));

  if (answers.length > 0) {
    const allCorrect = answers.every(Boolean);
    if (allCorrect) {
      lv.streak_full += 1;
      lv.streak_wrong = 0;
    } else {
      lv.streak_wrong += 1;
      lv.streak_full = 0;
    }
  }
  for (const k of answers) {
    lv.recent.push(k ? 1 : 0);
    if (lv.recent.length > WINDOW) lv.recent.shift();
  }
  const correct = lv.recent.filter(Boolean).length;
  lv.recent_accuracy = lv.recent.length ? correct / lv.recent.length : 1;

  lv.skill_level = skillLevelFromStore(storage, userId);
  const lp = levelWithPercentile(lv.skill_level);
  lv.grade_est = lp.grade;
  lv.percentile = lp.percentile;

  const events = [];
  if (lv.streak_full >= JUMP_STREAK) {
    events.push({ type: 'jump', band: lv.band });
    lv.band = Math.min(BANDS - 1, lv.band + 1);
    lv.streak_full = 0;
  }
  if (lv.streak_wrong >= DEMOTE_STREAK) {
    events.push({ type: 'demote', band: lv.band });
    lv.band = Math.max(0, lv.band - 1);
    lv.streak_wrong = 0;
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
  const learned = learnedByGrade[currentGL] || 0;
  const total = totalByGrade[currentGL] || 1;
  const percentile = percentileFromProgress(learned, total);

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
  JUMP_STREAK,
  DEMOTE_STREAK,
  WINDOW,
  BANDS,
  ensureLevel,
  recordAnswer,
  recordBatch,
  bandRange,
  getLevelView,
};
