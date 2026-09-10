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

function buildWeeklyReport(history) {
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

  const doctorNudge = {
    show: affected.length === DIMENSIONS.length,
    text: affected.length === DIMENSIONS.length ? DOCTOR_NUDGE_TEXT : null,
  };

  return { recommendations, doctorNudge };
}

module.exports = { buildWeeklyReport, LOW_SCORE, MIN_LOW_DAYS, MAX_RECOMMENDATIONS };
