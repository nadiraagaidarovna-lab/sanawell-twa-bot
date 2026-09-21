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
        habitsReminderOptIn: !!(user && user.habits_reminder_opt_in),
        menopausePath: user ? user.menopause_path : null,
        medicalDisclaimerConsented: !!(user && user.medical_disclaimer_consent_at),
        dataStorageConsented: !!(user && user.data_storage_consent_at),
        // Срез О3 (ТЗ v2.12, 6.2.1) — гейт показа экрана приветствия (Шаг 0), отдельно
        // от onboarded выше (та же цепочка полей и логика О1, этот срез её не трогает).
        onboardingWelcomeSeen: !!(user && user.onboarding_welcome_seen),
        // Срез О2, Промпт 1/4 (ТЗ v2.13, 6.2.2) — анкета онбординга, шаги 1-7. Отдельный
        // флаг от onboarded/onboardingWelcomeSeen выше — независимая часть флоу (Срез О6
        // соберёт всё в одну последовательность позже, здесь только данные и гейт).
        displayName: user ? user.display_name : null,
        ageRange: user ? user.age_range : null,
        selfPerceivedStage: user ? user.self_perceived_stage : null,
        lifestyleActivity: user ? user.lifestyle_activity : null,
        lifestyleDiet: user ? user.lifestyle_diet : null,
        stressLevel: user ? user.stress_level : null,
        goal: user ? user.goal : null,
        symptomChecklist: user ? user.symptom_checklist : null,
        onboardingAnketaCompleted: !!(user && user.onboarding_anketa_completed),
        // Срез Д, Промпт 5/5 (часть 2) — «Личный кабинет»: профиль и статус запроса на
        // удаление. Тарифа здесь нет намеренно — колонки в БД нет, экран хардкодит Basic.
        age: user ? user.age : null,
        email: user ? user.email : null,
        phone: user ? user.phone : null,
        accountDeleted: !!(user && user.deleted_at),
      });
    })
  );

  // Срез Д, Промпт 5/5 (часть 2): профиль из «Личного кабинета». Форма шлёт все 4 поля
  // сразу — полная замена, null/пустая строка очищает поле. Все поля необязательны.
  // Формат проверяем мягко (не блокируем экзотические, но реальные адреса/номера).
  router.post(
    '/profile',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { displayName, age, email, phone } = req.body || {};

      const isOptionalString = (v) => v === undefined || v === null || typeof v === 'string';
      if (![displayName, email, phone].every(isOptionalString)) {
        return res.status(400).json({ error: 'invalid_payload' });
      }

      if (age !== undefined && age !== null && (!Number.isInteger(age) || age < 18 || age > 100)) {
        return res.status(400).json({ error: 'invalid_age' });
      }

      const emailTrimmed = typeof email === 'string' ? email.trim() : '';
      if (emailTrimmed && (emailTrimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed))) {
        return res.status(400).json({ error: 'invalid_email' });
      }

      const phoneTrimmed = typeof phone === 'string' ? phone.trim() : '';
      if (phoneTrimmed) {
        const digits = phoneTrimmed.replace(/\D/g, '');
        const shapeOk = /^\+?[\d\s\-()]+$/.test(phoneTrimmed);
        if (!shapeOk || digits.length < 7 || digits.length > 15) {
          return res.status(400).json({ error: 'invalid_phone' });
        }
      }

      await db.updateProfile(req.telegramId, {
        displayName,
        age: age ?? null,
        email: emailTrimmed,
        phone: phoneTrimmed,
      });
      res.json({ ok: true });
    })
  );

  // Срез Д, Промпт 5/5 (часть 2): запрос на удаление аккаунта — soft-delete (метка
  // deleted_at + отключение напоминаний), данные физически не стираются. Идемпотентен.
  router.post(
    '/account/delete-request',
    requireAuth,
    asyncHandler(async (req, res) => {
      await db.softDeleteAccount(req.telegramId);
      res.json({ ok: true });
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

  // Срез О3 (ТЗ v2.12, 6.2.1): гейт "Шаг 0 показан один раз". Фронтенд ждёт ответ этого
  // запроса ДО навигации на главный экран (см. WelcomeScreen.tsx) — иначе закрытие Mini App
  // до ответа сервера оставило бы флаг не выставленным, и экран показался бы снова.
  router.post(
    '/onboarding-welcome-seen',
    requireAuth,
    asyncHandler(async (req, res) => {
      await db.setOnboardingWelcomeSeen(req.telegramId);
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

  // Срез О2, Промпт 1/4 (ТЗ v2.13, раздел 6.2.2) — анкета онбординга, шаги 1-7, сохраняется
  // по шагам (свой запрос на каждый шаг), не одной формой в конце. Шаг 4 (путь) переиспользует
  // POST /api/menopause-path выше — отдельного эндпоинта под него здесь нет.

  // Шаг 1 — имя.
  router.post(
    '/anketa/name',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { displayName } = req.body || {};
      if (displayName !== undefined && displayName !== null && typeof displayName !== 'string') {
        return res.status(400).json({ error: 'invalid_payload' });
      }
      await db.setDisplayName(req.telegramId, displayName ?? null);
      res.json({ ok: true });
    })
  );

  // Шаг 2 — возраст.
  router.post(
    '/anketa/age-range',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { ageRange } = req.body || {};
      if (!db.AGE_RANGES.includes(ageRange)) {
        return res.status(400).json({ error: 'invalid_age_range' });
      }
      await db.setAgeRange(req.telegramId, ageRange);
      res.json({ ok: true });
    })
  );

  // Шаг 3 — самоощущаемый этап (субъективная самооценка, не диагностический вывод
  // приложения — раздел 9.2 ТЗ).
  router.post(
    '/anketa/self-perceived-stage',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { stage } = req.body || {};
      if (!db.SELF_PERCEIVED_STAGES.includes(stage)) {
        return res.status(400).json({ error: 'invalid_self_perceived_stage' });
      }
      await db.setSelfPerceivedStage(req.telegramId, stage);
      res.json({ ok: true });
    })
  );

  // Шаг 5 — цель. Свободный текст (один из вариантов — "Своё", открытое поле), поэтому
  // здесь нет enum-валидации, только ограничение длины (см. db.setGoal).
  router.post(
    '/anketa/goal',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { goal } = req.body || {};
      if (goal !== undefined && goal !== null && typeof goal !== 'string') {
        return res.status(400).json({ error: 'invalid_payload' });
      }
      await db.setGoal(req.telegramId, goal ?? null);
      res.json({ ok: true });
    })
  );

  // Шаг 6 — образ жизни: один запрос на весь блок (не три отдельных) — весь шаг
  // пропускается одной кнопкой в интерфейсе (раздел 6.2.2 ТЗ). Каждое из трёх полей
  // необязательно и независимо валидируется в db.setLifestyle — невалидное/отсутствующее
  // значение отдельного поля не отклоняет весь запрос.
  router.post(
    '/anketa/lifestyle',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { activity, diet, stressLevel } = req.body || {};
      await db.setLifestyle(req.telegramId, { activity, diet, stressLevel });
      res.json({ ok: true });
    })
  );

  // Шаг 7 — чек-лист симптомов (мультивыбор по категориям, без баллов/вердикта).
  router.post(
    '/anketa/symptoms',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { checklist } = req.body || {};
      const isPlainObject = checklist !== null && typeof checklist === 'object' && !Array.isArray(checklist);
      if (!isPlainObject) {
        return res.status(400).json({ error: 'invalid_payload' });
      }
      await db.setSymptomChecklist(req.telegramId, checklist);
      res.json({ ok: true });
    })
  );

  // Завершение анкеты целиком (все 7 шагов пройдены или осознанно пропущены) — вызывается
  // фронтендом один раз после последнего шага, отдельно от onboarding_welcome_seen (Шаг 0)
  // и от onboarded (О1) — независимая часть флоу до финальной сборки в Срезе О6.
  router.post(
    '/anketa/complete',
    requireAuth,
    asyncHandler(async (req, res) => {
      await db.setOnboardingAnketaCompleted(req.telegramId);
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

  // Срез Ж: напоминание про технику питания/силовых нагрузок из библиотеки — независимый
  // opt-in от reminder-opt-in выше, тот же паттерн (приложение или кнопка "Отключить"
  // в самом сообщении бота, см. bot.js).
  router.post(
    '/habits-reminder-opt-in',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { optIn } = req.body || {};
      await db.setHabitsReminderOptIn(req.telegramId, !!optIn);
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

  // Срез Д, Промпт 5/5 (часть 2): блок «Мой прогресс» в «Личном кабинете» — сколько
  // уникальных дней с записью за всё время и дата последней (не 14-дневное окно истории).
  router.get(
    '/checkin/summary',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json(await db.getCheckinSummary(req.telegramId));
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
