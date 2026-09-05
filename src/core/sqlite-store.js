'use strict';
/**
 * SQLite 存储实现（better-sqlite3）。
 * 实现与 createMemoryStorage 相同的接口，供生产使用。
 * 表结构遵循策划案 13.3 DDL。
 */

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = null;
}

function safeParseArray(str, fallback = []) {
  if (Array.isArray(str)) return str;
  if (typeof str !== 'string') return fallback;
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

function createSqliteStorage(dbPath = ':memory:') {
  if (!Database) throw new Error('better-sqlite3 not available');
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname   TEXT NOT NULL,
      avatar_id  INTEGER NOT NULL DEFAULT 1,
      role       TEXT NOT NULL DEFAULT 'child',
      parent_pin TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS characters (
      char_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      hanzi       TEXT NOT NULL UNIQUE,
      pinyin      TEXT NOT NULL DEFAULT '',
      stroke_count INTEGER DEFAULT 0,
      study_order INTEGER NOT NULL,
      grade_level TEXT NOT NULL DEFAULT '',
      source      TEXT DEFAULT '',
      content_pack TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS content_pool (
      content_id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'word',
      chars TEXT NOT NULL DEFAULT '[]',
      grade_pack TEXT DEFAULT '',
      difficulty INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS user_progress (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL,
      char_id        INTEGER NOT NULL,
      warehouse      INTEGER NOT NULL DEFAULT 1,
      stage          INTEGER NOT NULL DEFAULT 0,
      next_review_at TEXT NOT NULL,
      last_result    INTEGER DEFAULT 0,
      review_count   INTEGER DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at     TEXT,
      UNIQUE(user_id, char_id)
    );
    CREATE TABLE IF NOT EXISTS user_level (
      user_id       INTEGER PRIMARY KEY,
      assessed_chars INTEGER DEFAULT 0,
      skill_level   INTEGER DEFAULT 0,
      grade_est     TEXT DEFAULT '',
      percentile    INTEGER DEFAULT 1,
      recent_accuracy REAL DEFAULT 1,
      streak_full   INTEGER DEFAULT 0,
      streak_wrong  INTEGER DEFAULT 0,
      band          INTEGER DEFAULT 0,
      recent        TEXT DEFAULT '[]',
      last_assessed_at TEXT,
      updated_at    TEXT
    );
    CREATE TABLE IF NOT EXISTS progress_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      char_id INTEGER,
      from_warehouse INTEGER,
      to_warehouse INTEGER,
      result INTEGER,
      kind TEXT DEFAULT 'review',
      ts TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const stmts = {
    listUsers: db.prepare('SELECT * FROM users ORDER BY user_id'),
    getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),
    createUser: db.prepare('INSERT INTO users (nickname, avatar_id, role) VALUES (?,?,?)'),
    deleteUser: db.prepare('DELETE FROM users WHERE user_id = ?'),
    deleteProgress: db.prepare('DELETE FROM user_progress WHERE user_id = ?'),
    deleteLevel: db.prepare('DELETE FROM user_level WHERE user_id = ?'),
    upsertChar: db.prepare(
      'INSERT INTO characters (hanzi,pinyin,stroke_count,study_order,grade_level,source,content_pack) VALUES (?,?,?,?,?,?,?) ' +
        'ON CONFLICT(hanzi) DO UPDATE SET pinyin=excluded.pinyin, stroke_count=excluded.stroke_count, study_order=excluded.study_order, grade_level=excluded.grade_level, source=excluded.source, content_pack=excluded.content_pack'
    ),
    getChar: db.prepare('SELECT * FROM characters WHERE char_id = ?'),
    getCharByHanzi: db.prepare('SELECT * FROM characters WHERE hanzi = ?'),
    allChars: db.prepare('SELECT * FROM characters ORDER BY study_order'),
    getProgress: db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND char_id = ?'),
    upsertProgress: db.prepare(
      'INSERT INTO user_progress (user_id,char_id,warehouse,stage,next_review_at,last_result,review_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ' +
        'ON CONFLICT(user_id,char_id) DO UPDATE SET warehouse=excluded.warehouse, stage=excluded.stage, next_review_at=excluded.next_review_at, last_result=excluded.last_result, review_count=excluded.review_count, updated_at=excluded.updated_at'
    ),
    allProgress: db.prepare('SELECT * FROM user_progress WHERE user_id = ?'),
    countByWarehouse: db.prepare('SELECT COUNT(*) AS n FROM user_progress WHERE user_id = ? AND warehouse = ?'),
    getLevel: db.prepare('SELECT * FROM user_level WHERE user_id = ?'),
    upsertLevel: db.prepare(
      'INSERT INTO user_level (user_id,assessed_chars,skill_level,grade_est,percentile,recent_accuracy,streak_full,streak_wrong,band,recent,last_assessed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET assessed_chars=excluded.assessed_chars, skill_level=excluded.skill_level, grade_est=excluded.grade_est, percentile=excluded.percentile, recent_accuracy=excluded.recent_accuracy, streak_full=excluded.streak_full, streak_wrong=excluded.streak_wrong, band=excluded.band, recent=excluded.recent, last_assessed_at=excluded.last_assessed_at, updated_at=excluded.updated_at'
    ),
    addLog: db.prepare('INSERT INTO progress_log (user_id,char_id,from_warehouse,to_warehouse,result,kind) VALUES (?,?,?,?,?,?)'),
    getLogs: db.prepare('SELECT * FROM progress_log WHERE user_id = ? ORDER BY id'),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'),
  };

  const api = {
    listUsers: () => stmts.listUsers.all(),
    getUser: (userId) => stmts.getUser.get(userId) || null,
    createUser({ nickname, avatarId = 1, role = 'child' }) {
      if (!nickname || typeof nickname !== 'string') throw new TypeError('nickname required');
      const info = stmts.createUser.run(String(nickname).trim(), avatarId, role);
      return stmts.getUser.get(info.lastInsertRowid);
    },
    deleteUser(userId) {
      stmts.deleteProgress.run(userId);
      stmts.deleteLevel.run(userId);
      stmts.deleteUser.run(userId);
    },

    upsertChars(chars) {
      for (const c of chars) {
        if (!c.hanzi) throw new TypeError('char.hanzi required');
        stmts.upsertChar.run(
          c.hanzi,
          c.pinyin || '',
          c.stroke_count || 0,
          c.study_order || 0,
          c.grade_level || '',
          c.source || '',
          c.content_pack || ''
        );
      }
      return api;
    },
    getChar: (charId) => stmts.getChar.get(charId) || null,
    getCharByHanzi: (hanzi) => stmts.getCharByHanzi.get(hanzi) || null,
    allChars: () => stmts.allChars.all(),

    getProgress: (userId, charId) => stmts.getProgress.get(userId, charId) || null,
    setProgress(userId, charId, rec) {
      stmts.upsertProgress.run(
        userId,
        charId,
        rec.warehouse,
        rec.stage || 0,
        rec.next_review_at,
        rec.last_result || 0,
        rec.review_count || 0,
        rec.created_at || new Date().toISOString(),
        rec.updated_at || new Date().toISOString()
      );
    },
    allProgress: (userId) => stmts.allProgress.all(userId),
    progressCountByWarehouse: (userId, warehouse) => stmts.countByWarehouse.get(userId, warehouse).n,

    getLevel: (userId) => {
      const row = stmts.getLevel.get(userId);
      if (!row) return null;
      row.recent = safeParseArray(row.recent, []);
      return row;
    },
    setLevel(userId, lv) {
      const recent = JSON.stringify(safeParseArray(lv.recent, []));
      stmts.upsertLevel.run(
        userId,
        lv.assessed_chars || 0,
        lv.skill_level || 0,
        lv.grade_est || '',
        lv.percentile || 1,
        lv.recent_accuracy || 1,
        lv.streak_full || 0,
        lv.streak_wrong || 0,
        lv.band || 0,
        recent,
        lv.last_assessed_at || new Date().toISOString(),
        lv.updated_at || new Date().toISOString()
      );
    },

    addLog(entry) {
      stmts.addLog.run(entry.userId, entry.charId || null, entry.from, entry.to, entry.result, entry.kind || 'review');
    },
    getLogs: (userId) => stmts.getLogs.all(userId),

    getSetting(key, fallback) {
      const row = stmts.getSetting.get(String(key));
      if (!row) return fallback;
      try {
        return JSON.parse(row.value);
      } catch (e) {
        return row.value;
      }
    },
    setSetting(key, value) {
      stmts.setSetting.run(String(key), JSON.stringify(value));
      return value;
    },

    close: () => db.close(),
  };
  return api;
}

module.exports = { createSqliteStorage, available: !!Database };
