'use strict';
/**
 * 领域组装层：把存储 + 内容 + 四仓库调度 + 持续评估组装成应用核心。
 * 主进程 IPC 直接调用本层方法。
 */

const content = require('./content');
const scheduler = require('./scheduler');
const engine = require('./engine');
const levels = require('./levels');

const SESSION_NEW = 5;     // 每次会话新学字数量
const SESSION_REVIEW = 5;  // 每次会话复习字数量
const PROBE_EVERY = 5;     // 每 5 题插入 1 个探测字

const DEFAULT_SETTINGS = {
  delays: { 1: 1, 2: 3, 3: 7, 4: 30 }, // 各仓库复习间隔（天），家长可配
  carrierThresholds: { word: 100, phrase: 500, sentence: 1200 }, // 只读默认
  sessionNew: SESSION_NEW,
  sessionReview: SESSION_REVIEW,
};

function createAppCore(storage, pack) {
  if (!pack || !Array.isArray(pack.chars) || !Array.isArray(pack.pool)) {
    throw new TypeError('pack must be { chars:[], pool:[] }');
  }
  storage.upsertChars(pack.chars);

  // 应用持久化的复习间隔配置
  const savedSettings = storage.getSetting('settings', null);
  if (savedSettings && savedSettings.delays) {
    scheduler.setNextDelays(savedSettings.delays);
  }

  const charById = (id) => storage.getChar(id);
  const learnedIds = (userId) => new Set(storage.allProgress(userId).map((p) => p.char_id));
  const knownHanziSet = (userId) =>
    new Set(storage.allProgress(userId).filter((p) => p.warehouse === 4).map((p) => storage.getChar(p.char_id).hanzi));

  /** 选择待学新字：从当前 band 区间按 study_order 取未学的字，不够则向后扩展 */
  function pickNewChars(userId, now = Date.now()) {
    const lv = engine.ensureLevel(storage, userId, now);
    const learned = learnedIds(userId);
    let band = lv.band;
    let pool = storage
      .allChars()
      .filter((c) => {
        const [lo, hi] = engine.bandRange(band);
        return c.study_order >= lo && c.study_order <= hi && !learned.has(c.char_id);
      })
      .sort((a, b) => a.study_order - b.study_order);
    while (pool.length < SESSION_NEW && band < engine.BANDS - 1) {
      band += 1;
      const [lo2, hi2] = engine.bandRange(band);
      const more = storage
        .allChars()
        .filter((c) => c.study_order >= lo2 && c.study_order <= hi2 && !learned.has(c.char_id))
        .sort((a, b) => a.study_order - b.study_order);
      pool = pool.concat(more);
    }
    return pool.slice(0, SESSION_NEW);
  }

  /** 探测字：略高于当前 band 的字（评估无感化） */
  function pickProbe(userId, now = Date.now()) {
    const lv = engine.ensureLevel(storage, userId, now);
    const learned = learnedIds(userId);
    const lo = Math.min(engine.BANDS - 1, lv.band + 1) * 300 + 1;
    const cand = storage
      .allChars()
      .filter((c) => c.study_order >= lo && !learned.has(c.char_id))
      .sort((a, b) => a.study_order - b.study_order);
    return cand[0] || null;
  }

  /** 把字 id 集合组词/组句；词句不足时退化为单字格 */
  function buildItems(userId, charIds, maxCarrier) {
    const test = new Set(charIds.map((id) => (charById(id) ? charById(id).hanzi : null)).filter(Boolean));
    if (test.size === 0) return [];
    const known = knownHanziSet(userId);
    const { items, actualType } = content.pickItemsWithFallback(pack.pool, known, test, maxCarrier, charIds.length);
    if (items.length === 0) {
      return charIds.slice(0, 8).map((id, i) => {
        const c = charById(id);
        if (!c) return null;
        return { content_id: -1 - i, text: c.hanzi, type: 'char', chars: [{ char_id: c.char_id, hanzi: c.hanzi, pinyin: c.pinyin }] };
      }).filter(Boolean);
    }
    return items.map((e) => ({
      content_id: e.content_id,
      text: e.text,
      type: e.type,
      chars: e.chars.map((h) => {
        const c = storage.getCharByHanzi(h);
        return { char_id: c ? c.char_id : null, hanzi: h, pinyin: c ? c.pinyin : '' };
      }),
    }));
  }

  function getSession(userId, now = Date.now()) {
    const lv = engine.ensureLevel(storage, userId, now);
    const carrier = content.carrierFor(lv.skill_level);
    const newChars = pickNewChars(userId, now);
    const due = scheduler.getDue(storage, userId, now);
    const reviewChars = due.slice(0, SESSION_REVIEW).map((p) => p.char_id);
    const probe = pickProbe(userId, now);
    return {
      carrier,
      newItems: buildItems(userId, newChars.map((c) => c.char_id), carrier),
      reviewItems: buildItems(userId, reviewChars, carrier),
      probe: probe ? { char_id: probe.char_id, hanzi: probe.hanzi, pinyin: probe.pinyin } : null,
      counts: scheduler.warehouseCounts(storage, userId),
      level: engine.getLevelView(storage, userId),
    };
  }

  /**
   * 提交一次会话结果。results: [{ charId, known }]
   * known=false 且未学过 → 学习（进 W1）；known=true 且未学过 → 直接进 W4；
   * 已学过 → 按仓库升降级规则。
   */
  function submitSession(userId, results, now = Date.now()) {
    if (!Array.isArray(results)) throw new TypeError('results must be array');
    const out = [];
    for (const r of results) {
      if (!r || !r.charId) continue;
      const existing = storage.getProgress(userId, r.charId);
      let res;
      if (existing) {
        res = scheduler.applyResult(storage, userId, r.charId, !!r.known, now);
        out.push({ charId: r.charId, from: res.from, to: res.to });
      } else {
        res = r.known
          ? scheduler.initialKnown(storage, userId, r.charId, now)
          : scheduler.startLearning(storage, userId, r.charId, now);
        out.push({ charId: r.charId, from: 0, to: res.ok ? res.progress.warehouse : null });
      }
    }
    // 持续评估：每次作答更新水平与事件
    let events = [];
    for (const r of results) {
      if (!r || !r.charId) continue;
      const e = engine.recordAnswer(storage, userId, !!r.known, now);
      if (e.events.length) events = events.concat(e.events);
    }
    return { results: out, events, level: engine.getLevelView(storage, userId), counts: scheduler.warehouseCounts(storage, userId) };
  }

  /** 探测字作答（不改变进度，只影响评估） */
  function submitProbe(userId, known, now = Date.now()) {
    const { level, events } = engine.recordAnswer(storage, userId, !!known, now);
    return { level, events };
  }

  function getProgress(userId) {
    const rows = storage.allProgress(userId).map((p) => {
      const c = charById(p.char_id);
      return {
        char_id: p.char_id,
        hanzi: c ? c.hanzi : '?',
        pinyin: c ? c.pinyin : '',
        warehouse: p.warehouse,
        next_review_at: p.next_review_at,
        last_result: p.last_result,
        review_count: p.review_count,
      };
    });
    return { rows, counts: scheduler.warehouseCounts(storage, userId), level: engine.getLevelView(storage, userId) };
  }

  /** 家长设置：复习间隔（天）可配并持久化 */
  function getSettings() {
    const saved = storage.getSetting('settings', null);
    if (!saved) return { ...DEFAULT_SETTINGS };
    return {
      delays: { ...DEFAULT_SETTINGS.delays, ...(saved.delays || {}) },
      carrierThresholds: DEFAULT_SETTINGS.carrierThresholds,
      sessionNew: saved.sessionNew || DEFAULT_SETTINGS.sessionNew,
      sessionReview: saved.sessionReview || DEFAULT_SETTINGS.sessionReview,
    };
  }
  function updateSettings(patch) {
    if (!patch || typeof patch !== 'object') throw new TypeError('patch must be object');
    const cur = getSettings();
    const next = {
      ...cur,
      ...patch,
      delays: { ...cur.delays, ...(patch.delays || {}) },
    };
    for (const k of [1, 2, 3, 4]) {
      if (!(Number(next.delays[k]) > 0)) throw new TypeError(`invalid delay for warehouse ${k}`);
      next.delays[k] = Number(next.delays[k]);
    }
    scheduler.setNextDelays(next.delays);
    storage.setSetting('settings', next);
    return next;
  }

  return {
    // 用户
    listUsers: () => storage.listUsers(),
    createUser: (data) => storage.createUser(data),
    deleteUser: (userId) => storage.deleteUser(userId),
    // 会话
    getSession,
    submitSession,
    submitProbe,
    getProgress,
    getLevel: (userId) => engine.getLevelView(storage, userId),
    getLogs: (userId) => storage.getLogs(userId),
    // 家长设置
    getSettings,
    updateSettings,
    // 调度/等级工具（供测试与诊断）
    scheduler,
    engine,
    levels,
    storage,
  };
}

module.exports = { createAppCore, SESSION_NEW, SESSION_REVIEW, PROBE_EVERY };
