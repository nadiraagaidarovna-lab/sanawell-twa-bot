// TodayActionCard.tsx — «Сегодня для вас» (TASK 01, п.11). Одна карточка — первая техника
// из уже существующего GET /api/checkin/weekly-report; это НЕ новый рекомендательный
// движок, только сужение существующего списка (до 3 карточек) до одной на главном экране.
// Формулировка "можно попробовать" вместо императива "нужно сделать" — намеренно.
interface TodayActionCardProps {
  title: string;
  duration: string;
  onStart: () => void;
}

export default function TodayActionCard({ title, duration, onStart }: TodayActionCardProps) {
  return (
    <section className="sw-section">
      <h2 className="sw-section-title">Сегодня для вас</h2>
      <div className="sw-action-card">
        <div>
          <p className="sw-action-eyebrow">Можно попробовать сегодня</p>
          <p className="sw-action-title">{title}</p>
          <p className="sw-action-duration">{duration}</p>
        </div>
        <button type="button" className="sw-action-btn" onClick={onStart}>
          Начать
        </button>
      </div>
    </section>
  );
}
