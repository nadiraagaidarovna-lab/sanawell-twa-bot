// EnvironmentScreen.tsx — раздел «Окружение и смысл» с главной. Материалов по теме пока нет,
// поэтому честная заглушка без обещаний (тот же приём, что TariffScreen). Не подставлять сюда
// чужие материалы (например, Гид о менопаузе).
import BottomNav from '../components/BottomNav';

export default function EnvironmentScreen() {
  return (
    <main className="screen v2-screen v2-accent-cabinet">
      <p className="eyebrow">SanaWell</p>
      <h1>Окружение и смысл</h1>
      <p className="body-text">Материалы по этой теме ещё готовятся.</p>
      <BottomNav active="environment" />
    </main>
  );
}
