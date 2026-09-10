// WeeklyChart.tsx — компактный линейный график 3 измерений за неделю (ТЗ 5.2/6.4, Срез Е2).
// Без сторонней библиотеки — тот же подход, что и SwipeCards/ScaleSlider в этом проекте:
// чистый SVG, брендовые цвета через CSS-переменные (работают и как SVG-атрибуты в браузерах).
export interface WeeklyChartEntry {
  date: string;
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
}

const WIDTH = 300;
const HEIGHT = 120;
const PAD_X = 12;
const PAD_Y = 14;

type SeriesKey = 'sleepScore' | 'moodScore' | 'memoryScore';

const SERIES: { key: SeriesKey; color: string; label: string }[] = [
  { key: 'sleepScore', color: 'var(--sw-terracotta)', label: 'Сон' },
  { key: 'moodScore', color: 'var(--sw-wine)', label: 'Настроение' },
  { key: 'memoryScore', color: 'var(--sw-gold)', label: 'Голова' },
];

function scaleX(index: number, count: number): number {
  if (count <= 1) return WIDTH / 2;
  return PAD_X + (index * (WIDTH - PAD_X * 2)) / (count - 1);
}

// Оценки 1-10 -> координата Y (инверсия: в SVG y растёт вниз, а 10 должно быть выше 1).
function scaleY(score: number): number {
  const t = (score - 1) / 9;
  return HEIGHT - PAD_Y - t * (HEIGHT - PAD_Y * 2);
}

function buildPath(entries: WeeklyChartEntry[], key: SeriesKey): string {
  return entries
    .map((entry, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i, entries.length)} ${scaleY(entry[key])}`)
    .join(' ');
}

function formatDayLabel(dateStr: string): string {
  const day = dateStr.split('-')[2];
  return String(Number(day));
}

export default function WeeklyChart({ entries }: { entries: WeeklyChartEntry[] }) {
  if (entries.length < 2) {
    return (
      <p className="body-text" style={{ color: 'var(--hint)' }}>
        Графику нужно хотя бы два дня с чек-ином на этой неделе — пока рано.
      </p>
    );
  }

  return (
    <div className="weekly-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="График самочувствия за неделю">
        {SERIES.map((series) => (
          <path
            key={series.key}
            d={buildPath(entries, series.key)}
            fill="none"
            stroke={series.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {SERIES.map((series) =>
          entries.map((entry, i) => (
            <circle
              key={`${series.key}-${entry.date}`}
              cx={scaleX(i, entries.length)}
              cy={scaleY(entry[series.key])}
              r={2.5}
              fill={series.color}
            />
          ))
        )}
      </svg>

      <div className="weekly-chart-labels">
        {entries.map((entry) => (
          <span key={entry.date}>{formatDayLabel(entry.date)}</span>
        ))}
      </div>

      <div className="weekly-chart-legend">
        {SERIES.map((series) => (
          <span className="weekly-chart-legend-item" key={series.key}>
            <span className="weekly-chart-legend-dot" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  );
}
