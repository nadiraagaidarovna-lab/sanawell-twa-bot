// routes.js — API для Web App. Все роуты требуют валидную initData (см. telegramAuth.js).
const express = require('express');
const db = require('./db');
const { getAllProtocols } = require('./protocols');
const { detectRiskTrigger, getSafetyResources } = require('./safety');
const { buildWeeklyReport } = require('./weeklyReport');

// "Исправить" доступна в течение 24 часов после ПЕРВОЙ отправки чек-ина за день (ТЗ 6.3.4).
// Т.к. чек-ин — одна запись в день, это на практике совпадает с "тот же Алматинский день"
// почти всегда; исключение — чек-ин у самой границы полуночи, который в ТЗ отдельно не
// оговорён и не стоит того, чтобы усложнять модель "один чек-ин = один день".
const CHECKIN_CORRECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

function shapeCheckin(row) {
  if (!row) return null;
  const createdAt = new Date(`${row.created_at.replace(' ', 'T')}Z`);
  return {
    sleepScore: row.sleep_score,
    moodScore: row.mood_score,
    memoryScore: row.memory_score,
    comment: row.comment,
    canCorrect: Date.now() - createdAt.getTime() < CHECKIN_CORRECTION_WINDOW_MS,
  };
}

// Express 4 не ловит отклонённые промисы из async-хендлеров сам (это фича только
// Express 5) — без этой обёртки ошибка БД тихо зависла бы без ответа клиенту вместо
// того, чтобы попасть в error-handler в server.js.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function buildRouter({ requireAuth, safetyProtocolEnabled = false }) {
  const router = express.Router();

  // Состояние пользователя при открытии Web App: выбран ли путь менопаузы, даны ли оба
  // обязательных согласия (раздел 13 ТЗ), пройден ли онбординг целиком. onboarded требует
  // путь + оба обязательных согласия (Срез О1) — язык и пуш-опт-ин НЕ входят в это условие:
  // язык можно менять в любой момент (не одноразовый гейт), пуш-напоминания опциональны
  // по определению (раздел 6.5, по умолчанию выключены). Фактическая проверка onboarded на
  // фронтенде (пропуск экранов онбординга для вернувшихся) — отдельный срез О6, ещё не сделан.
  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await db.getUser(req.telegramId);
      const onboarded = !!(
        user &&
        user.menopause_path &&
        user.medical_disclaimer_consent_at &&
        user.data_storage_consent_at
      );
      res.json({
        onboarded,
        language: user ? user.language : null,
        reminderOptIn: !!(user && user.reminder_opt_in),
        menopausePath: user ? user.menopause_path : null,
        medicalDisclaimerConsented: !!(user && user.medical_disclaimer_consent_at),
        dataStorageConsented: !!(user && user.data_storage_consent_at),
      });
    })
  );

  // Выбор языка (можно вызывать и до согласий — экран языка идёт до них, ТЗ 6.2 шаг 3;
  // также остаётся доступным в любой момент после онбординга, см. HomeScreen.tsx).
  router.post(
    '/language',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { language } = req.body || {};
      if (!db.SUPPORTED_LANGUAGES.includes(language)) {
        return res.status(400).json({ error: 'invalid_language' });
      }
      await db.setUserLanguage(req.telegramId, language);
      res.json({ ok: true });
    })
  );

  // Вопрос о пути менопаузы (ТЗ 6.2 шаг 2, раздел 3.1) — определяет образовательный трек
  // и маршрутизацию на весь дальнейший опыт (5.3.1 и далее, ещё не построены).
  router.post(
    '/menopause-path',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { path } = req.body || {};
      if (!db.MENOPAUSE_PATHS.includes(path)) {
        return res.status(400).json({ error: 'invalid_menopause_path' });
      }
      await db.setMenopausePath(req.telegramId, path);
      res.json({ ok: true });
    })
  );

  // Немедицинский дисклеймер и раскрытие хранения данных — 2 из 3 согласий раздела 13,
  // каждое своим эндпоинтом и своим полем в БД, чтобы отзыв одного не затрагивал другие
  // (третье согласие, пуш-уведомления, уже отдельный /reminder-opt-in ниже). consented:false
  // пока не вызывается ниоткуда во фронтенде — экран отзыва согласий из "Настроек" ещё не
  // построен (отдельный будущий срез, см. CLAUDE.md), но эндпоинт уже поддерживает эту ветку.
  router.post(
    '/consent/medical-disclaimer',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { consented } = req.body || {};
      await db.setMedicalDisclaimerConsent(req.telegramId, !!consented);
      res.json({ ok: true });
    })
  );

  router.post(
    '/consent/data-storage',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { consented } = req.body || {};
      await db.setDataStorageConsent(req.telegramId, !!consented);
      res.json({ ok: true });
    })
  );

  // Включение/отключение ежедневного напоминания — из приложения или по кнопке
  // "Отключить" прямо в сообщении бота (ТЗ 4.3: в один клик, без повторных предложений).
  router.post(
    '/reminder-opt-in',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { optIn } = req.body || {};
      await db.setReminderOptIn(req.telegramId, !!optIn);
      res.json({ ok: true });
    })
  );

  // Ежедневный чек-ин Mini App (ТЗ-v2.1.md, разделы 5.1/6.3/11): одна запись в день,
  // числовая шкала 1-10. Без LLM-обработки (извлечение тем, safety_flag) — это явно
  // Этап 2 по разделу 16 ТЗ,
  // здесь safety_flag остаётся false-заглушкой из схемы БД.

  // Чек-ин за сегодня, если уже отправлен — экран использует это при загрузке, чтобы
  // показать подтверждение + "Исправить" вместо пустой формы (ТЗ 6.3.4).
  router.get(
    '/checkin',
    requireAuth,
    asyncHandler(async (req, res) => {
      const checkin = await db.getTodayCheckin(req.telegramId);
      res.json({ checkin: shapeCheckin(checkin) });
    })
  );

  router.post(
    '/checkin',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { sleep, mood, memory, comment } = req.body || {};
      const scores = { sleep, mood, memory };

      const scoresValid = Object.values(scores).every(
        (v) => Number.isInteger(v) && v >= 1 && v <= 10
      );
      if (!scoresValid) {
        return res.status(400).json({ error: 'invalid_payload' });
      }
      if (comment !== undefined && comment !== null && typeof comment !== 'string') {
        return res.status(400).json({ error: 'invalid_payload' });
      }

      // touchOrCreateUser, не touchUser: на /checkin/ пользователь может дойти сюда, ни разу
      // не вызвав /language или /consent (там пока нет экранов онбординга/языка) — обычный
      // touchUser (UPDATE) в этом случае не создаёт строку в users, и INSERT ниже падает по
      // FOREIGN KEY. Найдено при добавлении /checkin/history (Срез А1, ТЗ 5.2/6.4).
      await db.touchOrCreateUser(req.telegramId);
      await db.upsertDailyCheckin(req.telegramId, {
        sleep,
        mood,
        memory,
        comment: comment ? comment.slice(0, 1000) : null,
      });

      const checkin = await db.getTodayCheckin(req.telegramId);
      res.json({ ok: true, checkin: shapeCheckin(checkin) });
    })
  );

  // "Мой путь" на /checkin/ (Срез А1, ТЗ 5.2/6.4 — минимальная версия): история чек-инов
  // за последние N дней, только из daily_checkins.
  router.get(
    '/checkin/history',
    requireAuth,
    asyncHandler(async (req, res) => {
      const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 30);
      const rows = await db.getCheckinHistory(req.telegramId, days);
      res.json({
        history: rows.map((row) => ({
          date: row.checkin_date,
          sleepScore: row.sleep_score,
          moodScore: row.mood_score,
          memoryScore: row.memory_score,
          comment: row.comment,
        })),
      });
    })
  );

  // Полная версия еженедельного отчёта (Срез Е1, ТЗ 5.2/6.4): подбор техник по паттерну
  // последних 7 дней daily_checkins + приглашение к врачу. Считается live при каждом
  // открытии — без отдельного состояния "уже показывали на этой неделе" (подтверждено
  // Надирой 10.09.2026). Сырые дневные данные для графика — отдельным вызовом
  // /checkin/history выше, здесь только производная часть (рекомендации/приглашение),
  // чтобы не дублировать одни и те же дневные значения в двух ответах.
  router.get(
    '/checkin/weekly-report',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await db.getCheckinHistory(req.telegramId, 7);
      const history = rows.map((row) => ({
        date: row.checkin_date,
        sleepScore: row.sleep_score,
        moodScore: row.mood_score,
        memoryScore: row.memory_score,
      }));
      res.json(buildWeeklyReport(history));
    })
  );

  // Весь список протоколов (для главного экрана "самопомощь")
  router.get('/protocols', requireAuth, (_req, res) => {
    res.json({ protocols: getAllProtocols() });
  });

  // Мягкая проверка свободного текста на маркеры риска.
  // Фронтенд вызывает это ПЕРЕД показом обычных протоколов, если где-то
  // в интерфейсе разрешён свободный ввод (например, необязательное поле "что беспокоит").
  //
  // За флагом SAFETY_PROTOCOL_ENABLED (CLAUDE.md, раздел "Защитный сценарий"): список
  // триггеров и текст кризисного сообщения (safety.js) не утверждены гинекологом-соучредителем,
  // поэтому пока флаг выключен — эндпоинт не анализирует текст и не запускает detectRiskTrigger
  // вообще, только отвечает risk:false. Включать в проде только после её review.
  router.post(
    '/safety-check',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!safetyProtocolEnabled) {
        return res.json({ risk: false });
      }

      const { text } = req.body || {};
      const trigger = detectRiskTrigger(text);

      if (trigger) {
        await db.insertSafetyEvent(req.telegramId, trigger);
        return res.json({ risk: true, ...getSafetyResources() });
      }

      res.json({ risk: false });
    })
  );

  // Справочник партнёров (Срез П1, ТЗ 5.6/6.6/10.5): весь список сразу, фронтенд
  // группирует по type/specialization. Без календаря/API — бронирование вручную по
  // link_url вне приложения; is_placeholder=true, пока Надира не заведёт реальных
  // партнёров напрямую в БД.
  router.get(
    '/partners',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const rows = await db.getPartners();
      res.json({
        partners: rows.map((row) => ({
          id: row.id,
          type: row.type,
          specialization: row.specialization,
          name: row.name,
          formatDescription: row.format_description,
          linkUrl: row.link_url,
          linkType: row.link_type,
          isPlaceholder: row.is_placeholder,
        })),
      });
    })
  );

  // Факт перехода по ссылке партнёра — для метрик конверсии (10.5), не бронирования.
  router.post(
    '/partners/:id/click',
    requireAuth,
    asyncHandler(async (req, res) => {
      const partnerId = Number(req.params.id);
      if (!Number.isInteger(partnerId)) {
        return res.status(400).json({ error: 'invalid_payload' });
      }
      await db.logPartnerClick(partnerId, req.telegramId);
      res.json({ ok: true });
    })
  );

  return router;
}

module.exports = { buildRouter };
