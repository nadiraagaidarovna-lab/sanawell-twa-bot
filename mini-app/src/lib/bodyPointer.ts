// bodyPointer.ts — какое упражнение из «Тела» показать в «Самочувствии» ссылкой «Загляните в
// «Тело»: …». Пул — плоский список конкретных упражнений (content/bodyExercises.ts) из
// разделов «Приседания», «Баланс и стабилизаторы таза», «Плечи», «Диастаз после родов»;
// вводный раздел «Принципы нагрузки» в пул НЕ входит — это общие принципы, а не отдельные
// упражнения, указателем на него ссылаться нельзя. Выбор — по номеру недели «по кругу»
// (стабильно в течение недели, меняется в понедельник по Алматы) — та же идея, что у ротации
// Питание/Силовые в backend/src/weeklyReport.js, но независимая от неё реализация на фронтенде.
import { BODY_SECTIONS } from '../content/bodyExercises';
import type { BodyTarget } from './bodyTarget';

const INTRO_SECTION_TITLE = 'Принципы нагрузки для женщин 40+';

// Алматы — UTC+5 без перехода на летнее время; неделя с понедельника (1 января 1970 был
// четвергом — день эпохи сдвигаем на 3).
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EPOCH_TO_MONDAY_DAYS = 3;

export function bodyExercisePool(): BodyTarget[] {
  return BODY_SECTIONS.filter((section) => section.title !== INTRO_SECTION_TITLE).flatMap((section) =>
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
