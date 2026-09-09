// db.js — минималистичное анонимное хранилище, теперь на Postgres (Neon, free-тир).
// Никаких имён, телефонов, e-mail — только telegram_id как единственный идентификатор.
//
// Срочный стопгеп (09.09.2026, ТЗ v2.9): раньше был node:sqlite на локальном файле —
// но на бесплатном тарифе Render файловая система эфемерна и стирается на каждом деплое
// и на каждом выходе инстанса из сна. Платный план+диск на Render потребовал бы карту на
// счету — вместо этого переехали на Neon: managed Postgres, честный бесплатный тир без
// карты, хранилище отделено от компьюта (compute может засыпать при простое — это только
// задержка на "разбудить", не потеря данных). Все функции ниже — асинхронные (Promise),
// это меняет и вызывающий код в routes.js/bot.js (await), а не только этот файл.
//
// Формат дат: везде TEXT в формате "YYYY-MM-DD HH:MI:SS" (UTC, без смещения) — то же самое,
// что раньше отдавал SQLite `datetime('now')`. Специально не переходим на нативный Postgres
// timestamp: driver `pg` парсил бы его в JS Date объект автоматически, а весь остальной код
// (routes.js: shapeCheckin и т.д.) ожидает строку и сам вручную парсит её в Date — переход
// на нативный тип потребовал бы менять эти места тоже, а это отдельная, не срочная уборка.
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUPPORTED_LANGUAGES = ['ru', 'kk'];

// "YYYY-MM-DD HH:MI:SS" в UTC — тот же формат, что отдавала SQLite datetime('now').
function nowUtcString() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function utcDaysAgoString(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Локальная (Алматы) дата в формате YYYY-MM-DD — сутки пользователя, а не UTC.
function almatyDateString(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
}

// Одним запросом (simple query protocol — можно несколько ;-выражений без параметров,
// как раньше db.exec(...) у node:sqlite). Вызывается один раз при старте сервера
// (server.js должен дождаться этого промиса до app.listen) — база на Neon пустая с нуля,
// поэтому в отличие от старой версии никакой отдельной миграции колонок не нужно.
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id             TEXT PRIMARY KEY,
      language                TEXT,
      consent_at              TEXT,
      reminder_opt_in         INTEGER NOT NULL DEFAULT 0,
      last_reminder_sent_date TEXT,
      created_at              TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
      last_seen_at            TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
    );

    -- Один лог = одна отметка по одному из трёх модулей старого трекера (module: 'sleep'
    -- | 'mood' | 'cognitive'). Осиротела после Среза В (маршрут / упразднён) — переносим
    -- 1:1 как есть, уборка осиротевших таблиц/роутов — отдельная задача (подтверждено
    -- Надирой).
    CREATE TABLE IF NOT EXISTS logs (
      id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      telegram_id  TEXT NOT NULL REFERENCES users(telegram_id),
      module       TEXT NOT NULL CHECK (module IN ('sleep','mood','cognitive')),
      value        TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE INDEX IF NOT EXISTS idx_logs_user_time ON logs(telegram_id, created_at);

    -- Флаги безопасности: факт срабатывания триггера, не текст сообщения. Тоже осиротела
    -- (см. logs выше) — /api/safety-check уже выключен флагом SAFETY_PROTOCOL_ENABLED.
    CREATE TABLE IF NOT EXISTS safety_events (
      id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      telegram_id  TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
    );

    -- Ежедневный чек-ин на /checkin/ — одна запись в день на пользователя, оценки 1-10.
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      telegram_id        TEXT NOT NULL REFERENCES users(telegram_id),
      checkin_date       TEXT NOT NULL,
      sleep_score        INTEGER NOT NULL CHECK (sleep_score BETWEEN 1 AND 10),
      mood_score         INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
      memory_score       INTEGER NOT NULL CHECK (memory_score BETWEEN 1 AND 10),
      comment            TEXT,
      safety_flag        INTEGER NOT NULL DEFAULT 0,
      corrected_manually INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
      updated_at         TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
      UNIQUE (telegram_id, checkin_date)
    );
  `);
}

async function getUser(telegramId) {
  const { rows } = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [String(telegramId)]);
  return rows[0] || null;
}

async function touchOrCreateUser(telegramId) {
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO users (telegram_id, last_seen_at)
     VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    [String(telegramId), now]
  );
}

async function setUserLanguage(telegramId, language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return;
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET language = $1 WHERE telegram_id = $2', [language, String(telegramId)]);
}

// reminderOptIn — пользователь сам решает на экране согласия (чекбокс, по умолчанию выключен).
async function upsertUserConsent(telegramId, reminderOptIn) {
  const now = new Date().toISOString();
  await touchOrCreateUser(telegramId);
  await pool.query(
    'UPDATE users SET consent_at = $1, last_seen_at = $2, reminder_opt_in = $3 WHERE telegram_id = $4',
    [now, now, reminderOptIn ? 1 : 0, String(telegramId)]
  );
}

async function setReminderOptIn(telegramId, optIn) {
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET reminder_opt_in = $1 WHERE telegram_id = $2', [
    optIn ? 1 : 0,
    String(telegramId),
  ]);
}

async function touchUser(telegramId) {
  await pool.query(
    `UPDATE users SET last_seen_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS') WHERE telegram_id = $1`,
    [String(telegramId)]
  );
}

async function insertLog(telegramId, moduleName, value) {
  await pool.query('INSERT INTO logs (telegram_id, module, value) VALUES ($1, $2, $3)', [
    String(telegramId),
    moduleName,
    value,
  ]);
}

async function getRecentLogs(telegramId, limit = 30) {
  const { rows } = await pool.query(
    `SELECT module, value, created_at FROM logs
     WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [String(telegramId), limit]
  );
  return rows;
}

// Экран "Мой путь" старого маршрута / (осиротел, см. комментарий у таблицы logs выше):
// сетка "отмечался ли модуль в этот день" за последние N дней.
async function getProgressGrid(telegramId, days = 14) {
  const { rows: logs } = await pool.query(
    `SELECT module, created_at FROM logs
     WHERE telegram_id = $1 AND created_at >= $2
     ORDER BY created_at ASC`,
    [String(telegramId), utcDaysAgoString(days)]
  );

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
    // created_at хранится в UTC ("YYYY-MM-DD HH:MI:SS"); переводим в Алматинские сутки.
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

// Одна запись в день на пользователя — повторная отправка в тот же Алматинский день
// обновляет ту же строку и помечает её corrected_manually (основа для "Исправить",
// ТЗ 6.3.4) — естественное следствие upsert по (telegram_id, checkin_date).
async function upsertDailyCheckin(telegramId, { sleep, mood, memory, comment }) {
  const date = almatyDateString(new Date());
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO daily_checkins
       (telegram_id, checkin_date, sleep_score, mood_score, memory_score, comment, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (telegram_id, checkin_date) DO UPDATE SET
       sleep_score = excluded.sleep_score,
       mood_score = excluded.mood_score,
       memory_score = excluded.memory_score,
       comment = excluded.comment,
       corrected_manually = 1,
       updated_at = excluded.updated_at`,
    [String(telegramId), date, sleep, mood, memory, comment ?? null, now]
  );
}

// Чек-ин за сегодня (если есть) — экран чек-ина использует это при загрузке, чтобы решить,
// показывать пустую форму или уже сохранённые ответы + "Исправить" (ТЗ 6.3.4).
async function getTodayCheckin(telegramId) {
  const date = almatyDateString(new Date());
  const { rows } = await pool.query(
    'SELECT * FROM daily_checkins WHERE telegram_id = $1 AND checkin_date = $2',
    [String(telegramId), date]
  );
  return rows[0] || null;
}

// "Мой путь" на /checkin/ (Срез А1, ТЗ 5.2/6.4 — минимальная версия без графика/подбора
// техник, см. CLAUDE.md): история чек-инов за последние N дней, только из daily_checkins.
// Старые chip-тег записи из logs сюда сознательно не подмешиваются (иная семантика данных,
// подтверждено Надирой — см. раздел 5.2 ТЗ v2.9).
async function getCheckinHistory(telegramId, days = 14) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffDate = almatyDateString(cutoff);

  const { rows } = await pool.query(
    `SELECT checkin_date, sleep_score, mood_score, memory_score, comment
     FROM daily_checkins
     WHERE telegram_id = $1 AND checkin_date >= $2
     ORDER BY checkin_date ASC`,
    [String(telegramId), cutoffDate]
  );
  return rows;
}

async function insertSafetyEvent(telegramId, triggerType) {
  await pool.query('INSERT INTO safety_events (telegram_id, trigger_type) VALUES ($1, $2)', [
    String(telegramId),
    triggerType,
  ]);
}

// Для планировщика напоминаний в bot.js: все, кто включил напоминания и ещё не получал их сегодня.
async function getUsersDueForReminder(todayAlmaty) {
  const { rows } = await pool.query(
    `SELECT telegram_id, language FROM users
     WHERE reminder_opt_in = 1
       AND (last_reminder_sent_date IS NULL OR last_reminder_sent_date != $1)`,
    [todayAlmaty]
  );
  return rows;
}

async function markReminderSent(telegramId, todayAlmaty) {
  await pool.query('UPDATE users SET last_reminder_sent_date = $1 WHERE telegram_id = $2', [
    todayAlmaty,
    String(telegramId),
  ]);
}

module.exports = {
  initSchema,
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
  getCheckinHistory,
  insertSafetyEvent,
  getUsersDueForReminder,
  markReminderSent,
  almatyDateString,
  SUPPORTED_LANGUAGES,
};
