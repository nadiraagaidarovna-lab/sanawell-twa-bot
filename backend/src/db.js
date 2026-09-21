// db.js — минималистичное анонимное хранилище, теперь на Postgres (Neon, free-тир).
// Изначально — никаких имён, телефонов, e-mail, только telegram_id как единственный
// идентификатор. Это уже не так: анкета (Срез О2) добавила display_name, «Личный кабинет»
// (Срез Д, Промпт 5/5, часть 2) — необязательные age/email/phone; всё под согласием
// «обработка персональных данных и данных о здоровье» (раздел 13 ТЗ).
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
      telegram_id                    TEXT PRIMARY KEY,
      language                       TEXT,
      -- Осиротело Срезом О1 (постоянный онбординг, раздел 13 ТЗ): раньше один общий
      -- consent_at на все согласия сразу, теперь — 2 отдельных поля ниже, каждое можно
      -- отозвать по отдельности (раздел 13 явно этого требует). Колонка и уже накопленные
      -- в ней данные оставлены как есть, тот же подход, что и у logs/safety_events —
      -- удаление старых данных БД отдельное решение, не часть этого среза.
      consent_at                     TEXT,
      medical_disclaimer_consent_at  TEXT,
      data_storage_consent_at        TEXT,
      menopause_path                 TEXT CHECK (menopause_path IN ('natural', 'surgical', 'oncological') OR menopause_path IS NULL),
      reminder_opt_in                INTEGER NOT NULL DEFAULT 0,
      last_reminder_sent_date        TEXT,
      -- Срез Ж: отдельный, независимый opt-in для напоминания про технику питания/силовых
      -- нагрузок из библиотеки (раздел 5.4) — сознательно НЕ то же поле, что reminder_opt_in
      -- выше (ежедневное напоминание про чек-ин): отключение одного не должно тихо отключать
      -- другое, у каждого своя кнопка "Отключить" в чате (см. bot.js).
      habits_reminder_opt_in         INTEGER NOT NULL DEFAULT 0,
      last_habits_reminder_sent_date TEXT,
      -- Срез О3 (ТЗ v2.12, раздел 6.2.1): гейт "показать экран приветствия (Шаг 0) один
      -- раз". Ключ — telegram_id, не устройство/localStorage, иначе гейт слетит при смене
      -- телефона или переустановке Telegram. Выставляется в true синхронно с переходом на
      -- главный экран (см. POST /api/onboarding-welcome-seen), не сбрасывается ручным
      -- повторным показом из настроек ("Показать приветствие снова").
      onboarding_welcome_seen        BOOLEAN NOT NULL DEFAULT false,
      -- Срез О2, Промпт 1/4 (ТЗ v2.13, раздел 6.2.2) — анкета онбординга, шаги 1-7. Путь
      -- менопаузы (шаг 4) переиспользует menopause_path из Среза О1 — новая колонка под
      -- него не заводится. Все поля ниже намеренно nullable/false по умолчанию: анкета
      -- целиком пропускаема и сохраняется по шагам, ни одно поле не обязательно для уже
      -- существующих пользователей, которые её ещё не проходили.
      display_name                   TEXT,
      age_range                      TEXT CHECK (age_range IN
        ('35_39', '40_44', '45_49', '50_54', '55_59', '60_plus', 'prefer_not_to_say') OR age_range IS NULL),
      self_perceived_stage           TEXT CHECK (self_perceived_stage IN
        ('perimenopause', 'menopause', 'postmenopause', 'unsure') OR self_perceived_stage IS NULL),
      lifestyle_activity             TEXT CHECK (lifestyle_activity IN
        ('low', 'sometimes', 'active') OR lifestyle_activity IS NULL),
      lifestyle_diet                 TEXT CHECK (lifestyle_diet IN
        ('regular', 'vegetarian', 'lactose_free', 'other', 'prefer_not_to_say') OR lifestyle_diet IS NULL),
      stress_level                   INTEGER CHECK (stress_level BETWEEN 1 AND 10 OR stress_level IS NULL),
      -- Свободный текст, не enum: один из вариантов шага 5 ("Своё") — открытое поле,
      -- поэтому остальные предустановленные варианты тоже хранятся как обычный текст
      -- этого же поля, а не отдельным кодом/enum (сама формулировка и есть значение).
      goal                           TEXT,
      -- Чек-лист симптомов (шаг 7, раздел 6.2.2) — произвольная JSON-структура по
      -- категориям (приливы/настроение/голова/тело/сон/близость), формируется фронтендом
      -- в Промпте 2-4; бэкенд намеренно не валидирует точные ключи — состав пунктов может
      -- ещё чуть измениться при вёрстке экрана, не должно требовать новой миграции.
      symptom_checklist              JSONB,
      onboarding_anketa_completed    BOOLEAN NOT NULL DEFAULT false,
      created_at                     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
      last_seen_at                   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
    );

    -- CREATE TABLE IF NOT EXISTS выше не трогает уже существующую на проде таблицу users
    -- (создана до Среза О1) — новые колонки нужно добавить явной миграцией, иначе локальная
    -- свежая БД и прод разойдутся по схеме. IF NOT EXISTS делает миграцию идемпотентной
    -- при повторных деплоях/рестартах.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_disclaimer_consent_at TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS data_storage_consent_at TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS menopause_path TEXT
      CHECK (menopause_path IN ('natural', 'surgical', 'oncological') OR menopause_path IS NULL);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS habits_reminder_opt_in INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_habits_reminder_sent_date TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_welcome_seen BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age_range TEXT
      CHECK (age_range IN ('35_39', '40_44', '45_49', '50_54', '55_59', '60_plus', 'prefer_not_to_say') OR age_range IS NULL);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS self_perceived_stage TEXT
      CHECK (self_perceived_stage IN ('perimenopause', 'menopause', 'postmenopause', 'unsure') OR self_perceived_stage IS NULL);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS lifestyle_activity TEXT
      CHECK (lifestyle_activity IN ('low', 'sometimes', 'active') OR lifestyle_activity IS NULL);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS lifestyle_diet TEXT
      CHECK (lifestyle_diet IN ('regular', 'vegetarian', 'lactose_free', 'other', 'prefer_not_to_say') OR lifestyle_diet IS NULL);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stress_level INTEGER
      CHECK (stress_level BETWEEN 1 AND 10 OR stress_level IS NULL);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS goal TEXT;
    -- Ключ выбранного предустановленного варианта цели (шаг 5 анкеты): goal хранит готовую
    -- подпись на языке экрана («Наладить сон»), по которой нельзя надёжно сопоставить цель с
    -- модулем техник (язык, «Своё»). NULL — «Своё», не выбрано или запись до этой колонки
    -- (бэкфилла нет). Используется только для приоритета техник в еженедельном отчёте.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_key TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS symptom_checklist JSONB;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_anketa_completed BOOLEAN NOT NULL DEFAULT false;
    -- Срез Д, Промпт 5/5 (часть 2) — «Личный кабинет» MVP (docs/personal-cabinet-v1.md).
    -- age — свободное числовое поле (не age_range выше: тот остаётся для анкеты, пока срез
    -- онбординга с исправлением возрастных категорий не сделан). email/phone — необязательные
    -- контакты профиля, без верификации. deleted_at — soft-delete аккаунта (пометка запроса
    -- на удаление, строка физически не стирается), тот же формат даты, что у остальных TEXT.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER
      CHECK (age BETWEEN 18 AND 100 OR age IS NULL);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TEXT;

    -- Один лог = одна отметка по одному из трёх модулей старого трекера (module: 'sleep'
    -- | 'mood' | 'cognitive'). Осиротела после Среза В (маршрут / упразднён); роуты и
    -- функции, писавшие/читавшие её (/api/track, /api/progress, /api/history), удалены
    -- в Срезе У1 — сама таблица и уже накопленные в ней данные оставлены как есть,
    -- удаление данных БД — отдельное решение, не часть уборки кода (подтверждено Надирой).
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

    -- Справочник партнёров (ТЗ 5.6/6.6/10.5) — без интеграции календаря/API, только
    -- карточка + внешняя ссылка. is_placeholder=true до того, как Надира заведёт реальных
    -- партнёров (напрямую в БД, без релиза кода — по замыслу раздела 10.5).
    CREATE TABLE IF NOT EXISTS partners (
      id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      type                TEXT NOT NULL CHECK (type IN ('doctor','lab')),
      specialization      TEXT CHECK (specialization IN ('gynecologist','nutritionist','endocrinologist') OR specialization IS NULL),
      name                TEXT NOT NULL,
      format_description  TEXT,
      link_url            TEXT NOT NULL,
      link_type           TEXT NOT NULL CHECK (link_type IN ('website','whatsapp')),
      is_placeholder      BOOLEAN NOT NULL DEFAULT false,
      sort_order          INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
    );

    -- Клик по ссылке партнёра — для метрик конверсии (раздел 10.5/14), не факт бронирования.
    CREATE TABLE IF NOT EXISTS partner_clicks (
      id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      partner_id   BIGINT NOT NULL REFERENCES partners(id),
      telegram_id  TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
    );
  `);

  await seedPlaceholderPartners();
}

// Плейсхолдеры (подтверждено Надирой 10.09.2026) — только если таблица ещё пуста, чтобы
// не плодить дубликаты при каждом деплое/рестарте и не мешать реальным данным, если их
// уже завели вручную. Ссылки — на example.com, сознательно нерабочие: не выдумываем
// телефон/WhatsApp, который может принадлежать реальному человеку.
async function seedPlaceholderPartners() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM partners');
  if (rows[0].count > 0) return;

  const placeholders = [
    ['doctor', 'gynecologist', 'Гинеколог — партнёр (плейсхолдер)', 'Очно, Алматы', 'https://example.com/partner-placeholder-1', 'website'],
    ['doctor', 'nutritionist', 'Нутрициолог — партнёр (плейсхолдер)', 'Онлайн-консультация', 'https://example.com/partner-placeholder-2', 'whatsapp'],
    ['doctor', 'endocrinologist', 'Эндокринолог — партнёр (плейсхолдер)', 'Очно, Алматы', 'https://example.com/partner-placeholder-3', 'website'],
    ['lab', null, 'Лаборатория — партнёр (плейсхолдер)', 'Забор анализов на дому и в филиалах', 'https://example.com/partner-placeholder-4', 'website'],
  ];

  for (let i = 0; i < placeholders.length; i += 1) {
    const [type, specialization, name, formatDescription, linkUrl, linkType] = placeholders[i];
    await pool.query(
      `INSERT INTO partners (type, specialization, name, format_description, link_url, link_type, is_placeholder, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
      [type, specialization, name, formatDescription, linkUrl, linkType, i]
    );
  }
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

// Срез О3: гейт "Шаг 0 показан один раз" — чтение идёт через уже существующий getUser()
// (тот же паттерн, что у остальных полей users в GET /api/me), отдельного геттера не
// заводим. Всегда true: "показать снова" из настроек — навигация на фронтенде, флаг не
// трогает.
async function setOnboardingWelcomeSeen(telegramId) {
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET onboarding_welcome_seen = true WHERE telegram_id = $1', [
    String(telegramId),
  ]);
}

const MENOPAUSE_PATHS = ['natural', 'surgical', 'oncological'];

async function setMenopausePath(telegramId, path) {
  if (!MENOPAUSE_PATHS.includes(path)) return;
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET menopause_path = $1 WHERE telegram_id = $2', [
    path,
    String(telegramId),
  ]);
}

// Срез О2, Промпт 1/4 (ТЗ v2.13, раздел 6.2.2) — анкета онбординга, шаги 1-7, сохраняется
// по шагам (каждый шаг — свой вызов), не одной большой формой. Шаг 4 (путь) переиспользует
// setMenopausePath выше, отдельного сеттера для него здесь нет.
const AGE_RANGES = ['35_39', '40_44', '45_49', '50_54', '55_59', '60_plus', 'prefer_not_to_say'];
const SELF_PERCEIVED_STAGES = ['perimenopause', 'menopause', 'postmenopause', 'unsure'];
const LIFESTYLE_ACTIVITIES = ['low', 'sometimes', 'active'];
const LIFESTYLE_DIETS = ['regular', 'vegetarian', 'lactose_free', 'other', 'prefer_not_to_say'];

// Свободный текст (необязательный "как вас называть") — не enum, обрезаем на случай
// злоупотребления, не отклоняем: это не критичное поле, не стоит того, чтобы блокировать
// шаг анкеты 400-й ошибкой из-за длины имени.
async function setDisplayName(telegramId, displayName) {
  await touchOrCreateUser(telegramId);
  const value = typeof displayName === 'string' ? displayName.trim().slice(0, 100) || null : null;
  await pool.query('UPDATE users SET display_name = $1 WHERE telegram_id = $2', [
    value,
    String(telegramId),
  ]);
}

async function setAgeRange(telegramId, ageRange) {
  if (!AGE_RANGES.includes(ageRange)) return;
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET age_range = $1 WHERE telegram_id = $2', [
    ageRange,
    String(telegramId),
  ]);
}

// Шаг 2 анкеты — возраст свободным числом (замена категорий setAgeRange выше, которая
// остаётся до отдельной уборки). Точечно обновляет ТОЛЬКО колонку age: не использовать
// updateProfile вместо неё — тот перезаписывает display_name/email/phone разом и обнулил бы
// имя, введённое на Шаге 1. Диапазон 18–100 — тот же, что у CHECK колонки и POST /profile.
const AGE_MIN = 18;
const AGE_MAX = 100;

async function setAge(telegramId, age) {
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) return;
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET age = $1 WHERE telegram_id = $2', [age, String(telegramId)]);
}

async function setSelfPerceivedStage(telegramId, stage) {
  if (!SELF_PERCEIVED_STAGES.includes(stage)) return;
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET self_perceived_stage = $1 WHERE telegram_id = $2', [
    stage,
    String(telegramId),
  ]);
}

// Свободный текст, не enum: один из вариантов шага 5 ("Своё") — открытое поле, см. коммент
// у схемы в initSchema().
// Известные ключи предустановленных вариантов цели (STEP5_GOAL в mini-app/src/content/anketa.ts,
// без 'custom'): любое другое значение goalKey — включая 'custom', пустое и неизвестное —
// молча пишется как NULL, без ошибки, чтобы рассинхрон фронта и бэка не ломал прохождение анкеты.
const GOAL_KEYS = ['hot_flashes', 'sleep', 'understand_body', 'confidence', 'nutrition_weight'];

async function setGoal(telegramId, goal, goalKey) {
  await touchOrCreateUser(telegramId);
  const value = typeof goal === 'string' ? goal.trim().slice(0, 200) || null : null;
  const keyValue = typeof goalKey === 'string' && GOAL_KEYS.includes(goalKey) ? goalKey : null;
  await pool.query('UPDATE users SET goal = $1, goal_key = $2 WHERE telegram_id = $3', [
    value,
    keyValue,
    String(telegramId),
  ]);
}

// Шаг 6 — один блок из 3 подвопросов, полностью необязательный и пропускаемый целиком
// (раздел 6.2.2) — поэтому один эндпоинт/вызов на весь шаг, а не три отдельных, в отличие
// от остальных шагов анкеты. Каждое из трёх полей независимо необязательно: невалидное или
// отсутствующее значение просто записывается как NULL (не отклоняем весь запрос из-за
// одного поля) — так можно, например, ответить на вопрос про стресс и пропустить питание.
async function setLifestyle(telegramId, { activity, diet, stressLevel }) {
  const activityValue = LIFESTYLE_ACTIVITIES.includes(activity) ? activity : null;
  const dietValue = LIFESTYLE_DIETS.includes(diet) ? diet : null;
  const stressValue =
    Number.isInteger(stressLevel) && stressLevel >= 1 && stressLevel <= 10 ? stressLevel : null;

  await touchOrCreateUser(telegramId);
  await pool.query(
    'UPDATE users SET lifestyle_activity = $1, lifestyle_diet = $2, stress_level = $3 WHERE telegram_id = $4',
    [activityValue, dietValue, stressValue, String(telegramId)]
  );
}

// Шаг 7 — чек-лист симптомов, JSONB. Бэкенд намеренно не проверяет точные ключи/категории
// (см. коммент у схемы) — только что это действительно объект, а не строка/массив/примитив,
// чтобы не записать в JSONB что попало из неправильно собранного фронтенда.
async function setSymptomChecklist(telegramId, checklist) {
  const isPlainObject =
    checklist !== null && typeof checklist === 'object' && !Array.isArray(checklist);
  if (!isPlainObject) return;

  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET symptom_checklist = $1 WHERE telegram_id = $2', [
    JSON.stringify(checklist),
    String(telegramId),
  ]);
}

// Отдельный флаг завершения анкеты целиком (все 7 шагов пройдены или осознанно
// пропущены) — по аналогии с onboarding_welcome_seen у Шага 0, отдельное поле от
// onboarded (Срез О1: путь + оба обязательных согласия), т.к. это независимые части
// онбординга с разным порядком прохождения в итоговом флоу (Срез О6).
async function setOnboardingAnketaCompleted(telegramId) {
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET onboarding_anketa_completed = true WHERE telegram_id = $1', [
    String(telegramId),
  ]);
}

// Срез Д, Промпт 5/5 (часть 2) — профиль из «Личного кабинета»: форма редактирования шлёт
// все четыре поля сразу, поэтому это полная замена значений (null/пустая строка очищает
// поле), а не частичный merge. Валидация формата — в routes.js, здесь только нормализация.
async function updateProfile(telegramId, { displayName, age, email, phone }) {
  await touchOrCreateUser(telegramId);
  const name = typeof displayName === 'string' ? displayName.trim().slice(0, 100) || null : null;
  const emailValue = typeof email === 'string' ? email.trim().slice(0, 254) || null : null;
  const phoneValue = typeof phone === 'string' ? phone.trim().slice(0, 32) || null : null;
  const ageValue = Number.isInteger(age) ? age : null;

  await pool.query(
    'UPDATE users SET display_name = $1, age = $2, email = $3, phone = $4 WHERE telegram_id = $5',
    [name, ageValue, emailValue, phoneValue, String(telegramId)]
  );
}

// Soft-delete аккаунта: ставим метку и сразу гасим оба напоминания, чтобы бот не писал
// тому, кто запросил удаление. Сами данные (чек-ины и т.д.) не стираются физически —
// окончательная обработка запроса — отдельный будущий процесс, не часть этого среза.
async function softDeleteAccount(telegramId) {
  await touchOrCreateUser(telegramId);
  await pool.query(
    `UPDATE users
     SET deleted_at = COALESCE(deleted_at, $1), reminder_opt_in = 0, habits_reminder_opt_in = 0
     WHERE telegram_id = $2`,
    [nowUtcString(), String(telegramId)]
  );
}

// Обратный путь к softDeleteAccount: снимает метку запроса на удаление. Напоминания
// (reminder_opt_in/habits_reminder_opt_in) сознательно НЕ включаем обратно — softDeleteAccount
// их выключил, а включать уведомления без явного нового согласия женщины противоречит
// принципу «напоминания только opt-in»; захочет — включит сама переключателями в кабинете.
// Без touchOrCreateUser: отменять нечего, если пользователя нет. Идемпотентна.
async function cancelAccountDeletion(telegramId) {
  await pool.query('UPDATE users SET deleted_at = NULL WHERE telegram_id = $1', [String(telegramId)]);
}

// Каждое согласие — отдельное поле, отзываемое по отдельности (раздел 13 ТЗ), а не один
// общий флаг на всё сразу (тот был у старого upsertUserConsent, убран Срезом О1). consented
// true -> проставляем текущую отметку времени; false (для будущего экрана отзыва, ещё не
// построен) -> возвращаем NULL, то есть "согласие не дано/отозвано".
async function setMedicalDisclaimerConsent(telegramId, consented) {
  await touchOrCreateUser(telegramId);
  const value = consented ? new Date().toISOString() : null;
  await pool.query('UPDATE users SET medical_disclaimer_consent_at = $1 WHERE telegram_id = $2', [
    value,
    String(telegramId),
  ]);
}

async function setDataStorageConsent(telegramId, consented) {
  await touchOrCreateUser(telegramId);
  const value = consented ? new Date().toISOString() : null;
  await pool.query('UPDATE users SET data_storage_consent_at = $1 WHERE telegram_id = $2', [
    value,
    String(telegramId),
  ]);
}

async function setReminderOptIn(telegramId, optIn) {
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET reminder_opt_in = $1 WHERE telegram_id = $2', [
    optIn ? 1 : 0,
    String(telegramId),
  ]);
}

async function setHabitsReminderOptIn(telegramId, optIn) {
  await touchOrCreateUser(telegramId);
  await pool.query('UPDATE users SET habits_reminder_opt_in = $1 WHERE telegram_id = $2', [
    optIn ? 1 : 0,
    String(telegramId),
  ]);
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

// «Мой прогресс» в «Личном кабинете» (Срез Д, Промпт 5/5, часть 2): число уникальных дней с
// записью и дата последней — за всё время, не за окно getCheckinHistory (14 дней).
async function getCheckinSummary(telegramId) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT checkin_date)::int AS days_count, MAX(checkin_date) AS last_checkin_date
     FROM daily_checkins
     WHERE telegram_id = $1`,
    [String(telegramId)]
  );
  return { daysCount: rows[0].days_count, lastCheckinDate: rows[0].last_checkin_date };
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
       AND deleted_at IS NULL
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

// Срез Ж: напоминание про технику питания/силовых нагрузок — раз в intervalDays дней
// (не каждый день, как getUsersDueForReminder выше), поэтому throttle не "!= сегодня",
// а "дата последней отправки достаточно старая". Cutoff считается в JS (та же схема, что
// и getCheckinHistory), не в SQL — избегаем смешивания часовых поясов между Node и Postgres.
async function getUsersDueForHabitsReminder(intervalDays) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - intervalDays);
  const cutoffDate = almatyDateString(cutoff);

  const { rows } = await pool.query(
    `SELECT telegram_id, language FROM users
     WHERE habits_reminder_opt_in = 1
       AND deleted_at IS NULL
       AND (last_habits_reminder_sent_date IS NULL OR last_habits_reminder_sent_date <= $1)`,
    [cutoffDate]
  );
  return rows;
}

async function markHabitsReminderSent(telegramId, todayAlmaty) {
  await pool.query('UPDATE users SET last_habits_reminder_sent_date = $1 WHERE telegram_id = $2', [
    todayAlmaty,
    String(telegramId),
  ]);
}

// Справочник партнёров (ТЗ 5.6/6.6/10.5) — весь список сразу, без пагинации: масштаб
// на MVP (единицы-десятки партнёров) не оправдывает её сложность. Фронтенд группирует
// по type/specialization сам, здесь просто фиксированный порядок показа.
async function getPartners() {
  const { rows } = await pool.query(
    `SELECT id, type, specialization, name, format_description, link_url, link_type, is_placeholder
     FROM partners
     ORDER BY sort_order ASC, id ASC`
  );
  return rows;
}

// Факт перехода по ссылке партнёра — для метрик конверсии (10.5/14), не бронирования:
// бэкенд не знает и не может знать, состоялась ли запись, она происходит вне приложения.
async function logPartnerClick(partnerId, telegramId) {
  await pool.query('INSERT INTO partner_clicks (partner_id, telegram_id) VALUES ($1, $2)', [
    partnerId,
    String(telegramId),
  ]);
}

module.exports = {
  initSchema,
  getUser,
  setUserLanguage,
  setOnboardingWelcomeSeen,
  setMenopausePath,
  setMedicalDisclaimerConsent,
  setDataStorageConsent,
  setReminderOptIn,
  setHabitsReminderOptIn,
  setDisplayName,
  setAgeRange,
  setAge,
  setSelfPerceivedStage,
  setGoal,
  setLifestyle,
  setSymptomChecklist,
  setOnboardingAnketaCompleted,
  updateProfile,
  softDeleteAccount,
  cancelAccountDeletion,
  getCheckinSummary,
  touchOrCreateUser,
  upsertDailyCheckin,
  getTodayCheckin,
  getCheckinHistory,
  insertSafetyEvent,
  getUsersDueForReminder,
  markReminderSent,
  getUsersDueForHabitsReminder,
  markHabitsReminderSent,
  getPartners,
  logPartnerClick,
  almatyDateString,
  SUPPORTED_LANGUAGES,
  MENOPAUSE_PATHS,
  AGE_RANGES,
  SELF_PERCEIVED_STAGES,
  LIFESTYLE_ACTIVITIES,
  LIFESTYLE_DIETS,
};
