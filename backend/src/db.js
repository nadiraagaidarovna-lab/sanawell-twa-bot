// db.js — минималистичное анонимное хранилище.
// Никаких имён, телефонов, e-mail — только telegram_id как единственный идентификатор.
//
// Использует встроенный в Node.js модуль node:sqlite (стабилен с Node 22.5+) вместо
// better-sqlite3 — это убирает нативную сборку из установки зависимостей (не нужен
// Python/toolchain ни локально, ни на build-сервере хостинга) при полностью совместимом
// API (prepare/run/get/all).
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sanawell.db');

// Гарантируем, что папка под базу существует
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id             TEXT PRIMARY KEY,
    language                TEXT,
    consent_at              TEXT,
    reminder_opt_in         INTEGER NOT NULL DEFAULT 0,
    last_reminder_sent_date TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Один лог = одна отметка по одному из трёх модулей трекера.
  -- module: 'sleep' | 'mood' | 'cognitive'
  -- value: короткий код состояния (например 'woke_up_night', 'anxious', 'fog'),
  --        UI отправляет уже готовый код — свободный текст сюда не пишем.
  CREATE TABLE IF NOT EXISTS logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id  TEXT NOT NULL,
    module       TEXT NOT NULL CHECK(module IN ('sleep','mood','cognitive')),
    value        TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
  );

  CREATE INDEX IF NOT EXISTS idx_logs_user_time ON logs(telegram_id, created_at);

  -- Флаги безопасности: фиксируем ФАКТ срабатывания триггера (не текст сообщения),
  -- чтобы можно было оценить частоту, не храня чувствительный контент.
  CREATE TABLE IF NOT EXISTS safety_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id  TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Mini App: ежедневный чек-ин (ТЗ-v2.1.md, раздел 11 "DailyCheckin") — отдельная
  -- сущность от старого 3-кнопочного трекера (logs выше): здесь одна запись в день
  -- на пользователя, с числовой шкалой 1-10 по каждому измерению, а не свободные
  -- отметки по символьному коду. safety_flag — заглушка (false) на Этапе 1; реальная
  -- LLM-проверка кризисных маркеров — Этап 2 (см. CLAUDE.md: без review гинеколога
  -- финальные формулировки не хардкодить).
  CREATE TABLE IF NOT EXISTS daily_checkins (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id        TEXT NOT NULL,
    checkin_date       TEXT NOT NULL,
    sleep_score        INTEGER NOT NULL CHECK(sleep_score BETWEEN 1 AND 10),
    mood_score         INTEGER NOT NULL CHECK(mood_score BETWEEN 1 AND 10),
    memory_score       INTEGER NOT NULL CHECK(memory_score BETWEEN 1 AND 10),
    comment            TEXT,
    safety_flag        INTEGER NOT NULL DEFAULT 0,
    corrected_manually INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(telegram_id, checkin_date),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
  );
`);

// Мягкая миграция для БД, созданных до Модуля 4/5 (v1 схема без этих колонок).
// В проде на этом этапе реальных пользователей ещё нет (файл БД в .gitignore),
// но try/catch делает это безопасным и для локальных БД, оставшихся с v1.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn('users', 'language', 'language TEXT');
ensureColumn('users', 'reminder_opt_in', 'reminder_opt_in INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'last_reminder_sent_date', 'last_reminder_sent_date TEXT');

const SUPPORTED_LANGUAGES = ['ru', 'kk'];

function getUser(telegramId) {
  return db.prepare(`SELECT * FROM users WHERE telegram_id = ?`).get(String(telegramId)) || null;
}

function touchOrCreateUser(telegramId) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (telegram_id, last_seen_at)
     VALUES (?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`
  ).run(String(telegramId), now);
}

function setUserLanguage(telegramId, language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return;
  touchOrCreateUser(telegramId);
  db.prepare(`UPDATE users SET language = ? WHERE telegram_id = ?`).run(language, String(telegramId));
}

// reminderOptIn — пользователь сам решает на экране согласия (чекбокс, по умолчанию выключен).
function upsertUserConsent(telegramId, reminderOptIn) {
  const now = new Date().toISOString();
  touchOrCreateUser(telegramId);
  db.prepare(
    `UPDATE users SET consent_at = ?, last_seen_at = ?, reminder_opt_in = ? WHERE telegram_id = ?`
  ).run(now, now, reminderOptIn ? 1 : 0, String(telegramId));
}

function setReminderOptIn(telegramId, optIn) {
  touchOrCreateUser(telegramId);
  db.prepare(`UPDATE users SET reminder_opt_in = ? WHERE telegram_id = ?`).run(
    optIn ? 1 : 0,
    String(telegramId)
  );
}

function touchUser(telegramId) {
  db.prepare(`UPDATE users SET last_seen_at = datetime('now') WHERE telegram_id = ?`).run(
    String(telegramId)
  );
}

function insertLog(telegramId, moduleName, value) {
  return db
    .prepare(`INSERT INTO logs (telegram_id, module, value) VALUES (?, ?, ?)`)
    .run(String(telegramId), moduleName, value);
}

function getRecentLogs(telegramId, limit = 30) {
  return db
    .prepare(
      `SELECT module, value, created_at FROM logs
       WHERE telegram_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(String(telegramId), limit);
}

// Локальная (Алматы) дата в формате YYYY-MM-DD — сутки пользователя, а не UTC.
function almatyDateString(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
}

// Экран "Мой путь": сетка "отмечался ли модуль в этот день" за последние N дней.
function getProgressGrid(telegramId, days = 14) {
  const logs = db
    .prepare(
      `SELECT module, created_at FROM logs
       WHERE telegram_id = ? AND created_at >= datetime('now', ?)
       ORDER BY created_at ASC`
    )
    .all(String(telegramId), `-${days} days`);

  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(almatyDateString(d));
  }

  const grid = { sleep: [], mood: [], cognitive: [] };
  const markedByModule = { sleep: new Set(), mood: new Set(), cognitive: new Set() };

  logs.forEach((log) => {
    // created_at хранится в UTC (datetime('now')); переводим в Алматинские сутки.
    const utcDate = new Date(`${log.created_at.replace(' ', 'T')}Z`);
    const dayKey = almatyDateString(utcDate);
    if (markedByModule[log.module]) markedByModule[log.module].add(dayKey);
  });

  dates.forEach((dayKey) => {
    ['sleep', 'mood', 'cognitive'].forEach((moduleName) => {
      grid[moduleName].push(markedByModule[moduleName].has(dayKey) ? 1 : 0);
    });
  });

  return { dates, grid };
}

// Одна запись в день на пользователя (ТЗ раздел 11) — повторная отправка в тот же
// Алматинский день обновляет ту же строку и помечает её corrected_manually (основа для
// "Исправить" из Среза 5, а не отдельная бизнес-логика здесь — естественное следствие
// upsert по (telegram_id, checkin_date)).
function upsertDailyCheckin(telegramId, { sleep, mood, memory, comment }) {
  const date = almatyDateString(new Date());
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO daily_checkins
       (telegram_id, checkin_date, sleep_score, mood_score, memory_score, comment, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(telegram_id, checkin_date) DO UPDATE SET
       sleep_score = excluded.sleep_score,
       mood_score = excluded.mood_score,
       memory_score = excluded.memory_score,
       comment = excluded.comment,
       corrected_manually = 1,
       updated_at = excluded.updated_at`
  ).run(String(telegramId), date, sleep, mood, memory, comment ?? null, now);
}

// Чек-ин за сегодня (если есть) — экран чек-ина использует это при загрузке, чтобы решить,
// показывать пустую форму или уже сохранённые ответы + "Исправить" (Срез 5, ТЗ 6.3.4).
function getTodayCheckin(telegramId) {
  const date = almatyDateString(new Date());
  return (
    db
      .prepare(`SELECT * FROM daily_checkins WHERE telegram_id = ? AND checkin_date = ?`)
      .get(String(telegramId), date) || null
  );
}

function insertSafetyEvent(telegramId, triggerType) {
  return db
    .prepare(`INSERT INTO safety_events (telegram_id, trigger_type) VALUES (?, ?)`)
    .run(String(telegramId), triggerType);
}

// Для планировщика напоминаний в bot.js: все, кто включил напоминания и ещё не получал их сегодня.
function getUsersDueForReminder(todayAlmaty) {
  return db
    .prepare(
      `SELECT telegram_id, language FROM users
       WHERE reminder_opt_in = 1
         AND (last_reminder_sent_date IS NULL OR last_reminder_sent_date != ?)`
    )
    .all(todayAlmaty);
}

function markReminderSent(telegramId, todayAlmaty) {
  db.prepare(`UPDATE users SET last_reminder_sent_date = ? WHERE telegram_id = ?`).run(
    todayAlmaty,
    String(telegramId)
  );
}

module.exports = {
  db,
  getUser,
  setUserLanguage,
  upsertUserConsent,
  setReminderOptIn,
  touchUser,
  touchOrCreateUser,
  insertLog,
  getRecentLogs,
  getProgressGrid,
  upsertDailyCheckin,
  getTodayCheckin,
  insertSafetyEvent,
  getUsersDueForReminder,
  markReminderSent,
  almatyDateString,
  SUPPORTED_LANGUAGES,
};
