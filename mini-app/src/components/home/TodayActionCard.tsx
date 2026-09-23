interface TodayActionCardProps {
  loading: boolean;
  title: string;
  duration?: string;
  onStart: () => void;
}

// Reuse one existing weekly recommendation or the existing self-help library.
// The library fallback is not presented as a personalized recommendation.
export default function TodayActionCard({ loading, title, duration, onStart }: TodayActionCardProps) {
  return (
    <section className="sw-section sw-action-card" aria-labelledby="home-action-title">
      <div>
        <h2 id="home-action-title" className="sw-action-heading">Сегодня для вас</h2>
        <p className="sw-action-title">{loading ? 'Загружаю…' : title}</p>
        {!loading && duration && <p className="sw-action-duration">{duration}</p>}
      </div>
      {!loading && <button type="button" className="sw-action-btn" onClick={onStart}>Открыть</button>}
    </section>
  );
}
