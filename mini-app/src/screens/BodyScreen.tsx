// BodyScreen.tsx — плейсхолдер папки «Тело» (Срез Д, Промпт 1/5, ТЗ 4.4.1). Реальный
// контент (интимное здоровье, гигиена) ещё не написан — когда появится, КАЖДАЯ статья
// обязательно проходит review гинекологом-соучредителем перед публикацией, без
// исключений (см. CLAUDE.md, «Жёсткие ограничения»), это условие плейсхолдер не снимает.
// Экран кликабелен и открывается нормально — не пустая заглушка без клика.
import BottomNav from '../components/BottomNav';

export default function BodyScreen() {
  return (
    <main className="screen v2-screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Тело</h1>
      <p className="body-text">Готовим, скоро 💛</p>
      <BottomNav active="body" />
    </main>
  );
}
