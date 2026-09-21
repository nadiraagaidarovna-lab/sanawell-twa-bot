// bodyPointer.ts — какое упражнение из «Тела» показать в «Самочувствии» ссылкой «Загляните в
// «Тело»: …». Пул — плоский список конкретных упражнений (content/bodyExercises.ts) из трёх
// разделов: «Приседания», «Баланс и стабилизаторы таза», «Плечи». НЕ входят: вводный раздел
// «Принципы нагрузки» (общие принципы, а не отдельные упражнения — указателем на него
// ссылаться нельзя) и «Диастаз после родов» (приложение не хранит, рожала ли женщина и есть
// ли у неё диастаз — предлагать это упражнение без разбора значит вводить в заблуждение тех,
// для кого оно не актуально; сам раздел на экране «Тело» остаётся). Выбор — по номеру недели
// «по кругу» (стабильно в течение недели, меняется в понедельник по Алматы) — та же идея, что у
// ротации Питание/Силовые в backend/src/weeklyReport.js, но независимая от неё реализация.
import { BODY_SECTIONS } from '../content/bodyExercises';
import type { BodyTarget } from './bodyTarget';

const EXCLUDED_SECTION_TITLES = [
  'Принципы нагрузки для женщин 40+',
  'Диастаз после родов — безопасная работа на косые мышцы',
];

// Алматы — UTC+5 без перехода на летнее время; неделя с понедельника (1 января 1970 был
// четвергом — день эпохи сдвигаем на 3).
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EPOCH_TO_MONDAY_DAYS = 3;

export function bodyExercisePool(): BodyTarget[] {
  return BODY_SECTIONS.filter((section) => !EXCLUDED_SECTION_TITLES.includes(section.title)).flatMap((section) =>
    section.items.map((item) => ({ sectionTitle: section.title, itemTitle: item.title }))
  );
}

/** Упражнение недели по номеру недели от `now` (параметр — только для проверки на синтетических неделях). */
export function pickBodyExercise(now: Date = new Date()): BodyTarget | null {
  const pool = bodyExercisePool();
  if (pool.length === 0) return null;
  const days = Math.floor((now.getTime() + ALMATY_OFFSET_MS) / DAY_MS);
  const week = Math.floor((days + EPOCH_TO_MONDAY_DAYS) / 7);
  return pool[week % pool.length];
}
