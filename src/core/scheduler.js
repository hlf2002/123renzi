'use strict';
/**
 * 四仓库记忆调度：仓库升降级 + 复习到期计算。
 * 依据策划案第 4 章（间隔 +3/+7/+30 天）与 3.3（当天复测 / 隔天复测）。
 */

const DAY = 24 * 60 * 60 * 1000;

// 各仓库「认识后」的下一复习延迟（天）：W1 次日复测，W2/W3/W4 递增
const NEXT_DELAY_DAYS = { 1: 1, 2: 3, 3: 7, 4: 30 };
// 兼容旧导出（语义=天数）
const NEXT_DELAY = NEXT_DELAY_DAYS;

let OVERRIDE_DELAYS = null;

/**
 * 设置可配置复习间隔（家长面板），单位：天。传 null 恢复默认。
 */
function setNextDelays(delays) {
  OVERRIDE_DELAYS = delays || null;
}

function toMs(date) {
  return date instanceof Date ? date.getTime() : new Date(date).getTime();
}

/**
 * 新学一个字（不认识 → 学一遍 → 进第一仓库，当天复测）
 * stage: 0=待当天复测, 1=当天已过待隔天复测（仅第一仓库使用）
 */
function startLearning(storage, userId, charId, now = Date.now()) {
  const existing = storage.getProgress(userId, charId);
  if (existing) return { ok: false, error: 'already in progress', progress: existing };
  const rec = {
    user_id: userId,
    char_id: charId,
    warehouse: 1,
    stage: 0,
    next_review_at: new Date(toMs(now)).toISOString(), // 当天立即复测
    last_result: 0,
    review_count: 0,
    created_at: new Date(toMs(now)).toISOString(),
    updated_at: new Date(toMs(now)).toISOString(),
  };
  storage.setProgress(userId, charId, rec);
  storage.addLog({ userId, charId, from: 0, to: 1, result: 0, kind: 'learn' });
  return { ok: true, progress: rec };
}

/**
 * 初次即认识的字：直接进第四仓库（已确认决策），+30 天后抽查
 */
function initialKnown(storage, userId, charId, now = Date.now()) {
  const existing = storage.getProgress(userId, charId);
  if (existing) return { ok: false, error: 'already in progress', progress: existing };
  const rec = {
    user_id: userId,
    char_id: charId,
    warehouse: 4,
    next_review_at: new Date(toMs(now) + nextDelayMs(4, true)).toISOString(),
    last_result: 1,
    review_count: 0,
    created_at: new Date(toMs(now)).toISOString(),
    updated_at: new Date(toMs(now)).toISOString(),
  };
  storage.setProgress(userId, charId, rec);
  storage.addLog({ userId, charId, from: 0, to: 4, result: 1, kind: 'initial-known' });
  return { ok: true, progress: rec };
}

/**
 * 复习/判定结果：
 * - 认识：第一仓库需「当天复测」+「隔天复测」两次都认识才升第二仓库；
 *          其余仓库升一级（第四仓库保持）；重算下次复习时间。
 * - 不认识：任何仓库回第一仓库（stage 归 0），当天立即复测。
 */
function applyResult(storage, userId, charId, known, now = Date.now()) {
  const p = storage.getProgress(userId, charId);
  if (!p) return { ok: false, error: 'no progress', from: null, to: null };
  const from = p.warehouse;
  let to;
  if (!known) {
    to = 1;
    p.stage = 0;
  } else if (from === 1) {
    if (!p.stage) {
      p.stage = 1; // 当天复测认识 → 仍留第一仓库，待隔天复测
      to = 1;
    } else {
      to = 2; // 隔天复测认识 → 升第二仓库
      p.stage = 0;
    }
  } else if (from >= 4) {
    to = 4;
  } else {
    to = from + 1;
  }
  p.warehouse = to;
  p.last_result = known ? 1 : 0;
  p.review_count = (p.review_count || 0) + 1;
  p.updated_at = new Date(toMs(now)).toISOString();
  p.next_review_at = new Date(toMs(now) + nextDelayMs(to, known)).toISOString();
  storage.setProgress(userId, charId, p);
  storage.addLog({ userId, charId, from, to, result: known ? 1 : 0, kind: 'review' });
  return { ok: true, from, to };
}

function nextDelayMs(warehouse, known) {
  if (!known) return 0; // 不认识 → 当天立即复测
  const map = OVERRIDE_DELAYS || NEXT_DELAY_DAYS;
  const v = map[warehouse];
  return (v != null ? v : map[1]) * DAY;
}

/**
 * 到期复习字列表（按仓库优先级升序）
 */
function getDue(storage, userId, now = Date.now()) {
  const t = toMs(now);
  return storage
    .allProgress(userId)
    .filter((p) => toMs(p.next_review_at) <= t)
    .sort((a, b) => a.warehouse - b.warehouse || String(a.next_review_at).localeCompare(String(b.next_review_at)));
}

/**
 * 各仓库字数统计
 */
function warehouseCounts(storage, userId) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of storage.allProgress(userId)) counts[p.warehouse] = (counts[p.warehouse] || 0) + 1;
  return counts;
}

/**
 * 已掌握字量（长期掌握数 = 第四仓库字数），用于水平估计 / 载体 / 激励
 */
function skillLevel(storage, userId) {
  return storage.progressCountByWarehouse ? storage.progressCountByWarehouse(userId, 4) : warehouseCounts(storage, userId)[4];
}

module.exports = {
  DAY,
  NEXT_DELAY,
  setNextDelays,
  startLearning,
  initialKnown,
  applyResult,
  getDue,
  warehouseCounts,
  skillLevel,
  nextDelayMs,
};
