// InsightCard.tsx — «Мы заметили» (TASK 01, п.10). Показывает ТОЛЬКО реальный текст,
// который уже приходит с бэкенда в GET /api/checkin/weekly-report (backend/src/
// weeklyReport.js) — никаких новых корреляций или причинности не придумываем на фронтенде.
// Родитель (HomeScreen.tsx) сам решает, есть ли у него подлинное наблюдение по паттерну
// недели (в отличие от reason цели анкеты/фоновой ротации питания-силовых, которые не
// являются "мы заметили что-то по вашим данным") — см. REAL_OBSERVATION_MARKER там же.
interface InsightCardProps {
  loading: boolean;
  observationText: string | null;
  onSeeMore: () => void;
}

const EMPTY_STATE_TEXT =
  'Продолжайте отмечать самочувствие — со временем здесь появится ваша личная динамика.';

export default function InsightCard({ loading, observationText, onSeeMore }: InsightCardProps) {
  return (
    <section className="sw-section">
      <div className="sw-insight-card">
        <h2 className="sw-insight-title">Мы заметили</h2>
        <p className="sw-insight-body">{loading ? 'Загружаю…' : (observationText ?? EMPTY_STATE_TEXT)}</p>
        {!loading && (
          <button type="button" className="sw-insight-cta" onClick={onSeeMore}>
            Посмотреть динамику →
          </button>
        )}
      </div>
    </section>
  );
}
