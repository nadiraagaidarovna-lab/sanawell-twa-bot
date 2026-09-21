// weeklyReport.js — подбор техник по паттерну недели + приглашение к врачу (ТЗ 5.2/6.4).
// Чистая функция от истории чек-инов (без БД внутри) — сознательно отделена от routes.js,
// чтобы пороги/логику можно было проверить отдельным скриптом на синтетических неделях,
// не поднимая сервер (см. отчёт по Срезу Е1).
//
// Пороги подтверждены Надирой (10.09.2026):
// - "просевшее" измерение — 3+ дня из дней с чек-ином на этой неделе с оценкой ≤ LOW_SCORE;
//   счёт от фактического числа дней с чек-ином, а не от 7 — женщина могла отметиться не
//   каждый день, требовать долю от 7 было бы строже, чем нужно для 1-2 пропущенных дней.
// - Приглашение к врачу — только если ВСЕ три измерения просели одновременно (не одно из
//   трёх) — консервативный сигнал, чтобы не показывать его слишком часто на обычной неделе
//   с одной локальной проблемой (например только сон).
const { getProtocolsForModule } = require('./protocols');

const LOW_SCORE = 4;
const MIN_LOW_DAYS = 3;
const MAX_RECOMMENDATIONS = 3;

// Порядок — Сон/Настроение/Голова, как везде в интерфейсе (карточки чек-ина, ТЗ 4.4).
// reason — отдельный шаблон на каждое измерение, не общая фраза с подстановкой: у "Сон"/
// "Настроение"/"Голова" разный род, единый шаблон с окончаниями получался неестественным.
const DIMENSIONS = [
  {
    key: 'sleepScore',
    module: 'sleep',
    reason: (lowDays, totalDays) =>
      `Сон был беспокойным ${lowDays} из ${totalDays} дней с чек-ином на этой неделе — вот что может помочь.`,
  },
  {
    key: 'moodScore',
    module: 'mood',
    reason: (lowDays, totalDays) =>
      `Настроение было тяжёлым ${lowDays} из ${totalDays} дней с чек-ином на этой неделе — вот что может помочь.`,
  },
  {
    key: 'memoryScore',
    module: 'cognitive',
    reason: (lowDays, totalDays) =>
      `Голова была в тумане ${lowDays} из ${totalDays} дней с чек-ином на этой неделе — вот что может помочь.`,
  },
];

// Мягкий, немедицинский текст — без упоминания диагноза/лечения (см. CLAUDE.md, раздел
// "Немедицинское позиционирование") и без ссылки на запись — партнёрского справочника
// (раздел 5.6 ТЗ) в коде ещё нет, добавлять ссылку было бы преждевременно.
const DOCTOR_NUDGE_TEXT =
  'Эта неделя была тяжёлой сразу по нескольким направлениям — сну, настроению и ' +
  'ясности мыслей. Иногда в такие периоды стоит показаться врачу — гинекологу или ' +
  'терапевту — просто чтобы разобраться и получить поддержку.';

// Срез «ротация + цель» (backend): пустые слоты после просевших измерений заполняются —
// сначала одной техникой по цели из анкеты (если у цели есть прямой модуль), затем фоновой
// ротацией Питание/Силовые. Питание/Силовые не измеряются чек-ином, поэтому раньше в отчёт
// не попадали вовсе. «Тело» (content/bodyExercises.ts) в ротацию НЕ входит — другая форма
// данных (без duration), не совпадает с Protocol; подключать его — отдельное решение.
const GOAL_REASON =
  'В анкете вы отметили, что это сейчас для вас важно — вот с чего можно начать.';
const ROTATION_REASON = 'Не связано с отметками этой недели, но помогает системно.';
const ROTATION_MODULES = ['nutrition', 'strength'];

// users.goal — СВОБОДНЫЙ ТЕКСТ, а не enum: экран анкеты (AnketaGoalScreen.tsx) сохраняет
// готовую подпись варианта на языке экрана («Наладить сон»), поэтому сравнение с
// 'sleep'/'nutrition_weight' по одному лишь ключу не сработало бы никогда. Здесь — и ключи
// (на случай, если фронтенд когда-нибудь начнёт слать value), и точные подписи из
// mini-app/src/content/anketa.ts (STEP5_GOAL, ru и kk) — при смене подписей там обновить и
// здесь. Остальные цели (приливы, «разобраться», уверенность, своё, null) прямого модуля не
// имеют — рекомендацию не форсируем.
const GOAL_TO_MODULE = {
  sleep: 'sleep',
  'Наладить сон': 'sleep',
  'Ұйқыны реттеу': 'sleep',
  nutrition_weight: 'nutrition',
  'Наладить питание и вес': 'nutrition',
  'Тамақтану мен салмақты реттеу': 'nutrition',
};

function goalModule(goal) {
  if (typeof goal !== 'string') return null;
  return GOAL_TO_MODULE[goal.trim()] ?? null;
}

// Номер недели для детерминированной ротации: без колонки/таблицы «уже показано» — отчёт
// по-прежнему не кэшируется и пересчитывается вживую. Алматы — UTC+5 без перехода на летнее
// время, поэтому фиксированное смещение. Неделя — с понедельника (1 января 1970 был
// четвергом, поэтому день эпохи сдвигаем на 3), иначе смена ротации пришлась бы на четверг.
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EPOCH_TO_MONDAY_DAYS = 3;

function rotationPool() {
  return ROTATION_MODULES.flatMap((module) =>
    getProtocolsForModule(module).map((protocol) => ({ module, protocol }))
  );
}

// Сдвиг пула на номер недели — каждую неделю первой идёт другая техника, внутри одной недели
// порядок и набор стабильны.
function rotatedPool(now) {
  const pool = rotationPool();
  if (pool.length === 0) return pool;
  const days = Math.floor((now.getTime() + ALMATY_OFFSET_MS) / DAY_MS);
  const week = Math.floor((days + EPOCH_TO_MONDAY_DAYS) / 7);
  const offset = week % pool.length;
  return [...pool.slice(offset), ...pool.slice(0, offset)];
}

// goal — значение users.goal (необязательно; чистота функции сохранена — БД не трогаем);
// now — только для тестов на синтетических неделях.
function buildWeeklyReport(history, goal = null, now = new Date()) {
  const totalDays = history.length;

  const affected = DIMENSIONS.map((dim) => {
    const lowDays = history.filter((row) => row[dim.key] <= LOW_SCORE).length;
    return { ...dim, lowDays };
  }).filter((dim) => dim.lowDays >= MIN_LOW_DAYS);

  const recommendations = [];
  for (const dim of affected) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;

    const reason = dim.reason(dim.lowDays, totalDays);

    for (const protocol of getProtocolsForModule(dim.module)) {
      if (recommendations.length >= MAX_RECOMMENDATIONS) break;
      recommendations.push({ dimension: dim.module, reason, protocol });
    }
  }

  // Без единой отметки за неделю ничего сверх прежнего не добавляем: карточки «не связано с
  // отметками этой недели» на пустой неделе выглядели бы беспричинно.
  if (totalDays > 0) {
    // 1) Цель из анкеты — одна техника модуля цели, если этого модуля ещё нет в
    //    рекомендациях (измерение просело — не дублируем) и есть свободный слот.
    const targetModule = goalModule(goal);
    if (
      targetModule &&
      recommendations.length < MAX_RECOMMENDATIONS &&
      !recommendations.some((rec) => rec.dimension === targetModule)
    ) {
      const [protocol] = getProtocolsForModule(targetModule);
      if (protocol) {
        recommendations.push({ dimension: targetModule, reason: GOAL_REASON, protocol });
      }
    }

    // 2) Фоновая ротация Питание/Силовые — в оставшиеся слоты, без повторов: технику,
    //    которая уже в списке (например, по цели), повторно не берём.
    for (const { module, protocol } of rotatedPool(now)) {
      if (recommendations.length >= MAX_RECOMMENDATIONS) break;
      if (recommendations.some((rec) => rec.protocol.id === protocol.id)) continue;
      recommendations.push({ dimension: module, reason: ROTATION_REASON, protocol });
    }
  }

  const doctorNudge = {
    show: affected.length === DIMENSIONS.length,
    text: affected.length === DIMENSIONS.length ? DOCTOR_NUDGE_TEXT : null,
  };

  return { recommendations, doctorNudge };
}

module.exports = { buildWeeklyReport, LOW_SCORE, MIN_LOW_DAYS, MAX_RECOMMENDATIONS };
