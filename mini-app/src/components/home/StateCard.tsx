// StateCard.tsx — hero-компонент главного экрана v3 (TASK 01, брифинг «REFACTOR THE
// EXISTING APP», п.7). Показывает нейтральное самоощущение — простое среднее трёх УЖЕ
// существующих измерений чек-ина (сон/настроение/голова), полученных через существующий
// GET /api/checkin. Это НЕ "health score": формулировки "Здоровье"/"Индекс здоровья"/
// "Диагноз"/"Риск" здесь и не должны появляться нигде рядом. Если чек-ина за сегодня ещё
// нет — пустое состояние с тем же CTA "+ Отметить самочувствие", который открывает уже
// существующий флоу чек-ина (CheckinScreen.tsx) — сама логика чек-ина здесь не трогается.
interface TodayCheckin {
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
}

interface StateCardProps {
  loading: boolean;
  checkin: TodayCheckin | null;
  onOpenCheckin: () => void;
}

// Нейтральные бытовые слова — не диагностические категории.
function stateWord(avg: number): string {
  if (avg >= 8) return 'Отлично';
  if (avg >= 6.5) return 'Хорошо';
  if (avg >= 5) return 'Нормально';
  if (avg >= 3.5) return 'Непросто';
  return 'Тяжело';
}

function formatAverage(avg: number): string {
  return avg.toFixed(1).replace('.', ',');
}

export default function StateCard({ loading, checkin, onOpenCheckin }: StateCardProps) {
  if (loading) {
    return (
      <div className="sw-state-card">
        <p className="sw-state-label">Моё состояние</p>
        <p className="body-text" style={{ color: 'var(--sw-v3-ink-soft)', margin: 0 }}>
          Загружаю…
        </p>
      </div>
    );
  }

  if (!checkin) {
    return (
      <div className="sw-state-card">
        <p className="sw-state-empty-title">Как вы сегодня?</p>
        <button type="button" className="sw-cta-primary" onClick={onOpenCheckin}>
          + Отметить самочувствие
        </button>
      </div>
    );
  }

  const avg = (checkin.sleepScore + checkin.moodScore + checkin.memoryScore) / 3;

  return (
    <div className="sw-state-card">
      <p className="sw-state-label">Моё состояние</p>
      <div className="sw-state-value-row">
        <span className="sw-state-value">{formatAverage(avg)}</span>
        <span className="sw-state-max">/ 10</span>
      </div>
      <p className="sw-state-word">{stateWord(avg)}</p>
      <button type="button" className="sw-cta-primary" onClick={onOpenCheckin}>
        + Отметить самочувствие
      </button>
    </div>
  );
}
