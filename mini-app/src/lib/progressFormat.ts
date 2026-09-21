// progressFormat.ts — форматирование блока «Мой прогресс» (число дней с записью и дата
// последней): общее для «Личного кабинета» (CabinetScreen.tsx) и главного экрана
// (ProgressHook.tsx), чтобы обе версии одной и той же фразы не разъезжались.

// 1 день / 2–4 дня / 5+ дней (11–14 — «дней»).
export function pluralDays(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

// 'YYYY-MM-DD' -> 'DD.MM.YYYY' без Date, чтобы часовой пояс не сдвинул день.
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
