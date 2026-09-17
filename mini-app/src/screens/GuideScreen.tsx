// GuideScreen.tsx — плейсхолдер папки «Гид» (Срез Д, Промпт 1/5, ТЗ 4.4.1). Реальный
// образовательный контент (раздел 5.3/5.3.1 ТЗ) — отдельная будущая задача (Промпт 4/5),
// ещё не написан. Экран кликабелен и открывается нормально — не пустая заглушка без
// клика, просто внутри пока нет содержимого (решение Надиры от 17.09.2026).
import BottomNav from '../components/BottomNav';

export default function GuideScreen() {
  return (
    <main className="screen v2-screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Гид</h1>
      <p className="body-text">Готовим, скоро 💛</p>
      <BottomNav active="guide" />
    </main>
  );
}
