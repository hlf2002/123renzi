'use strict';
/**
 * 存储接口定义 + 内存实现。
 * core 层只依赖本接口，不依赖具体存储实现（内存/SQLite/JSON 可互换）。
 * 内存实现用于单元测试；生产默认 SQLite（见 sqlite-store.js）。
 */

function createMemoryStorage() {
  const users = new Map();          // id -> user
  const characters = new Map();     // id -> char
  const charByHanzi = new Map();    // hanzi -> char
  const progress = new Map();       // `${userId}:${charId}` -> progress rec
  const levels = new Map();         // userId -> level rec
  const settings = new Map();       // key -> value
  const logs = [];

  let uid = 0;
  let cid = 0;

  const api = {
    // ---------- users ----------
    listUsers() {
      return [...users.values()];
    },
    getUser(userId) {
      return users.get(userId) || null;
    },
    createUser({ nickname, avatarId = 1, role = 'child' }) {
      if (!nickname || typeof nickname !== 'string') throw new TypeError('nickname required');
      const rec = { user_id: ++uid, nickname: String(nickname).trim(), avatar_id: avatarId, role, created_at: new Date().toISOString() };
      users.set(rec.user_id, rec);
      return { ...rec };
    },
    deleteUser(userId) {
      users.delete(userId);
      levels.delete(userId);
      for (const k of [...progress.keys()]) {
        if (k.startsWith(`${userId}:`)) progress.delete(k);
      }
    },

    // ---------- characters（全局共享） ----------
    upsertChars(chars) {
      for (const c of chars) {
        if (!c.hanzi) throw new TypeError('char.hanzi required');
        let rec = charByHanzi.get(c.hanzi);
        if (!rec) { rec = { char_id: ++cid, ...c }; characters.set(rec.char_id, rec); charByHanzi.set(rec.hanzi, rec); }
        else Object.assign(rec, c);
      }
      return api;
    },
    getChar(charId) {
      return characters.get(charId) || null;
    },
    getCharByHanzi(hanzi) {
      return charByHanzi.get(hanzi) || null;
    },
    allChars() {
      return [...characters.values()];
    },

    // ---------- user_progress（按用户隔离） ----------
    getProgress(userId, charId) {
      return progress.get(`${userId}:${charId}`) || null;
    },
    setProgress(userId, charId, rec) {
      progress.set(`${userId}:${charId}`, rec);
    },
    allProgress(userId) {
      const out = [];
      for (const [k, v] of progress) {
        if (k.startsWith(`${userId}:`)) out.push(v);
      }
      return out;
    },
    progressCountByWarehouse(userId, warehouse) {
      let n = 0;
      for (const [k, v] of progress) {
        if (k.startsWith(`${userId}:`) && v.warehouse === warehouse) n++;
      }
      return n;
    },

    // ---------- user_level ----------
    getLevel(userId) {
      return levels.get(userId) || null;
    },
    setLevel(userId, lv) {
      levels.set(userId, lv);
    },

    // ---------- logs ----------
    addLog(entry) {
      logs.push({ ...entry, ts: new Date().toISOString() });
    },
    getLogs(userId) {
      return logs.filter((l) => l.userId === userId);
    },

    // ---------- settings（键值） ----------
    getSetting(key, fallback) {
      return settings.has(key) ? settings.get(key) : fallback;
    },
    setSetting(key, value) {
      settings.set(key, value);
      return value;
    },

    // 内存实现专用：清空（测试用）
    _reset() {
      users.clear(); characters.clear(); charByHanzi.clear(); progress.clear(); levels.clear(); settings.clear(); logs.length = 0;
      uid = 0; cid = 0;
    },
  };
  return api;
}

module.exports = { createMemoryStorage };
