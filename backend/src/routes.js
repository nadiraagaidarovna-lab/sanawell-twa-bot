// routes.js — API для Web App. Все роуты требуют валидную initData (см. telegramAuth.js).
const express = require('express');
const db = require('./db');
const { getAllProtocols, getProtocolsForModule } = require('./protocols');
const { detectRiskTrigger, getSafetyResources } = require('./safety');

function buildRouter({ requireAuth }) {
  const router = express.Router();

  // Состояние пользователя при открытии Web App: выбран ли язык, пройден ли онбординг.
  // Позволяет фронтенду пропустить экран выбора языка и/или согласия для вернувшегося
  // пользователя (ТЗ, Модуль 4.1 и 5.1).
  router.get('/me', requireAuth, (req, res) => {
    const user = db.getUser(req.telegramId);
    res.json({
      onboarded: !!(user && user.consent_at),
      language: user ? user.language : null,
      reminderOptIn: !!(user && user.reminder_opt_in),
    });
  });

  // Выбор языка (можно вызывать и до согласия — экран языка идёт первым, ТЗ 5.1).
  router.post('/language', requireAuth, (req, res) => {
    const { language } = req.body || {};
    if (!db.SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'invalid_language' });
    }
    db.setUserLanguage(req.telegramId, language);
    res.json({ ok: true });
  });

  // Подтверждение согласия при первом входе (экран "Разрешаем входить").
  // reminderOptIn — необязательный чекбокс "присылать напоминание", по умолчанию false.
  router.post('/consent', requireAuth, (req, res) => {
    const { reminderOptIn } = req.body || {};
    db.upsertUserConsent(req.telegramId, !!reminderOptIn);
    res.json({ ok: true });
  });

  // Включение/отключение ежедневного напоминания — из приложения или по кнопке
  // "Отключить" прямо в сообщении бота (ТЗ 4.3: в один клик, без повторных предложений).
  router.post('/reminder-opt-in', requireAuth, (req, res) => {
    const { optIn } = req.body || {};
    db.setReminderOptIn(req.telegramId, !!optIn);
    res.json({ ok: true });
  });

  // Запись одной отметки трекера: { module: 'sleep'|'mood'|'cognitive', value: 'anxious' }
  router.post('/track', requireAuth, (req, res) => {
    const { module: moduleName, value } = req.body || {};
    const allowedModules = ['sleep', 'mood', 'cognitive'];

    if (!allowedModules.includes(moduleName) || !value || typeof value !== 'string') {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    db.touchUser(req.telegramId);
    db.insertLog(req.telegramId, moduleName, value.slice(0, 64));

    res.json({
      ok: true,
      protocols: getProtocolsForModule(moduleName),
    });
  });

  // Ежедневный чек-ин Mini App (ТЗ-v2.1.md, разделы 5.1/6.3/11) — отдельная сущность от
  // /track выше (старый 3-кнопочный трекер): одна запись в день, числовая шкала 1-10.
  // Без LLM-обработки (извлечение тем, safety_flag) — это явно Этап 2 по разделу 16 ТЗ,
  // здесь safety_flag остаётся false-заглушкой из схемы БД.
  router.post('/checkin', requireAuth, (req, res) => {
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

    db.touchUser(req.telegramId);
    const result = db.upsertDailyCheckin(req.telegramId, {
      sleep,
      mood,
      memory,
      comment: comment ? comment.slice(0, 1000) : null,
    });

    res.json({ ok: true, date: result.date, correctedManually: result.correctedManually });
  });

  // История последних отметок (сырые записи)
  router.get('/history', requireAuth, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    res.json({ logs: db.getRecentLogs(req.telegramId, limit) });
  });

  // Экран "Мой путь": сетка по дням за последние 7-14 дней на три модуля (ТЗ 4.2).
  router.get('/progress', requireAuth, (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 30);
    res.json(db.getProgressGrid(req.telegramId, days));
  });

  // Весь список протоколов (для главного экрана "самопомощь")
  router.get('/protocols', requireAuth, (_req, res) => {
    res.json({ protocols: getAllProtocols() });
  });

  // Мягкая проверка свободного текста на маркеры риска.
  // Фронтенд вызывает это ПЕРЕД показом обычных протоколов, если где-то
  // в интерфейсе разрешён свободный ввод (например, необязательное поле "что беспокоит").
  router.post('/safety-check', requireAuth, (req, res) => {
    const { text } = req.body || {};
    const trigger = detectRiskTrigger(text);

    if (trigger) {
      db.insertSafetyEvent(req.telegramId, trigger);
      return res.json({ risk: true, ...getSafetyResources() });
    }

    res.json({ risk: false });
  });

  return router;
}

module.exports = { buildRouter };
