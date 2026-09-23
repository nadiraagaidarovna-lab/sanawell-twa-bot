import MiniSparkline, { type SparklineEntry } from './MiniSparkline';

interface StateCardProps {
  loading: boolean;
  error: boolean;
  checkin: { sleepScore: number; moodScore: number; memoryScore: number } | null;
  history: SparklineEntry[];
  historyLoading: boolean;
}

// Display the user's actual answers, not a new aggregate or diagnostic score.
export default function StateCard({ loading, error, checkin, history, historyLoading }: StateCardProps) {
  return (
    <section className="sw-state-card" aria-labelledby="home-state-title" aria-busy={loading}>
      <div className="sw-state-heading">
        <h2 id="home-state-title">Моё состояние</h2>
        <span className="sw-period">7 дней</span>
      </div>
      {loading ? <p className="sw-state-note">Загружаю…</p> :
        error ? <p className="sw-state-note">Не удалось загрузить отметку за сегодня.</p> :
        checkin ? (
          <dl className="sw-state-values" aria-label="Ваши отметки за сегодня">
            <div><dt>Сон</dt><dd>{checkin.sleepScore}<span> / 10</span></dd></div>
            <div><dt>Настроение</dt><dd>{checkin.moodScore}<span> / 10</span></dd></div>
            <div><dt>Голова</dt><dd>{checkin.memoryScore}<span> / 10</span></dd></div>
          </dl>
        ) : <p className="sw-state-note">Сегодня ещё нет отметки.</p>}
      {historyLoading ? <p className="sw-state-note">Загружаю динамику…</p> :
        <MiniSparkline entries={history} />}
    </section>
  );
}
