// techniquesTarget.ts — «открой "Мой план поддержки" сразу на нужном модуле». Навигация передаёт
// только ID экрана, поэтому карточка главной кладёт модуль сюда, а TechniquesScreen читает его
// при открытии и показывает только этот модуль. Одноразовый, как guideTarget.ts: обычный вход
// (например, «Сегодня для вас») по-прежнему открывает все техники.
export interface TechniquesTarget {
  module: 'nutrition' | 'sleep' | 'mood';
  title: string;
}

let pending: TechniquesTarget | null = null;

export function setTechniquesTarget(target: TechniquesTarget): void {
  pending = target;
}

// Read without clearing (safe for a state initializer that may run twice in development).
export function peekTechniquesTarget(): TechniquesTarget | null {
  return pending;
}

export function clearTechniquesTarget(): void {
  pending = null;
}
