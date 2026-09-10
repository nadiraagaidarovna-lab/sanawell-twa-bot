// routes.js — API для Web App. Все роуты требуют валидную initData (см. telegramAuth.js).
const express = require('express');
const db = require('./db');
const { getAllProtocols, getProtocolsForModule } = require('./protocols');
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

  // Состояние пользователя при открытии Web App: выбран ли язык, пройден ли онбординг.
  // Позволяет фронтенду пропустить экран выбора языка и/или согласия для вернувшегося
  // пользователя (ТЗ, Модуль 4.1 и 5.1).
  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await db.getUser(req.telegramId);
      res.json({
        onboarded: !!(user && user.consent_at),
        language: user ? user.language : null,
        reminderOptIn: !!(user && user.reminder_opt_in),
      });
    })
  );

  // Выбор языка (можно вызывать и до согласия — экран языка идёт первым, ТЗ 5.1).
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

  // Подтверждение согласия при первом входе (экран "Разрешаем входить").
  // reminderOptIn — необязательный чекбокс "присылать напоминание", по умолчанию false.
  router.post(
    '/consent',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { reminderOptIn } = req.body || {};
      await db.upsertUserConsent(req.telegramId, !!reminderOptIn);
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

  // Запись одной отметки трекера: { module: 'sleep'|'mood'|'cognitive', value: 'anxious' }
  router.post(
    '/track',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { module: moduleName, value } = req.body || {};
      const allowedModules = ['sleep', 'mood', 'cognitive'];

      if (!allowedModules.includes(moduleName) || !value || typeof value !== 'string') {
        return res.status(400).json({ error: 'invalid_payload' });
      }

      await db.touchUser(req.telegramId);
      await db.insertLog(req.telegramId, moduleName, value.slice(0, 64));

      res.json({
        ok: true,
        protocols: getProtocolsForModule(moduleName),
      });
    })
  );

  // Ежедневный чек-ин Mini App (ТЗ-v2.1.md, разделы 5.1/6.3/11) — отдельная сущность от
  // /track выше (старый 3-кнопочный трекер): одна запись в день, числовая шкала 1-10.
  // Без LLM-обработки (извлечение тем, safety_flag) — это явно Этап 2 по разделу 16 ТЗ,
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
  // за последние N дней, только из daily_checkins (не переиспользует /progress ниже —
  // тот читает старую таблицу logs старого маршрута / и его пока трогать не нужно).
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

  // История последних отметок (сырые записи)
  router.get(
    '/history',
    requireAuth,
    asyncHandler(async (req, res) => {
      const limit = Math.min(Number(req.query.limit) || 30, 100);
      const logs = await db.getRecentLogs(req.telegramId, limit);
      res.json({ logs });
    })
  );

  // Экран "Мой путь": сетка по дням за последние 7-14 дней на три модуля (ТЗ 4.2).
  router.get(
    '/progress',
    requireAuth,
    asyncHandler(async (req, res) => {
      const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 30);
      const grid = await db.getProgressGrid(req.telegramId, days);
      res.json(grid);
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
