// bodyTarget.ts — «открой «Тело» сразу на нужном упражнении»: навигация приложения передаёт
// только ID экрана (push('body')), без параметров — тот же приём, что guideTarget.ts для Гида.
// Ссылка из «Самочувствия» («Загляните в «Тело»: …») кладёт сюда пару «раздел + упражнение»,
// BodyScreen забирает её при открытии. Одноразовый: после чтения сбрасывается, обычный вход
// в «Тело» (папка, нижняя навигация) открывает все секции свёрнутыми. У упражнений нет
// отдельных id — идентификатор это title (тот же, что React-ключ в BodyScreen.tsx).
export interface BodyTarget {
  sectionTitle: string;
  itemTitle: string;
}

let pendingTarget: BodyTarget | null = null;

export function setBodyTarget(target: BodyTarget): void {
  pendingTarget = target;
}

export function consumeBodyTarget(): BodyTarget | null {
  const target = pendingTarget;
  pendingTarget = null;
  return target;
}
