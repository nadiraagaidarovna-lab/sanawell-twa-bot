// CheckinScreen.tsx — Срез 1: заглушка, доказывающая, что навигация и нативная BackButton
// работают. Реальный UI шкал 1–10 + текстовое поле — Срез 3; сохранение в БД — Срез 4.
export default function CheckinScreen() {
  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Чек-ин</h1>
      <p className="body-text">
        Экран со шкалами появится на следующем срезе. Кнопка «Назад» вверху — уже нативная
        Telegram-кнопка, не кастомная.
      </p>
    </main>
  );
}
