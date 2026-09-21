// TariffScreen.tsx — экран-плейсхолдер «Скоро» для «Управлять подпиской»/«Изменить тариф»
// из «Личного кабинета» (Срез Д, Промпт 5/5, часть 2, docs/personal-cabinet-v1.md). Платёжный
// провайдер и цены Plus/Premium не утверждены (раздел 17 ТЗ) — поэтому ни цен, ни оплаты
// здесь нет, по образцу «Гид»/«Тело» до появления контента.
import BottomNav from '../components/BottomNav';

export default function TariffScreen() {
  return (
    <main className="screen v2-screen v2-accent-cabinet">
      <p className="eyebrow">SanaWell</p>
      <h1>Тариф</h1>
      <p className="body-text">Готовим, скоро 💛</p>
      <BottomNav active="cabinet" />
    </main>
  );
}
