// MiniSparkline.tsx — компактный график «Эта неделя» (TASK 01, п.9). Переиспользует ту же
// scaleX/scaleY-математику, что WeeklyChart.tsx (тот компонент не трогаем — он всё ещё
// нужен ProgressScreen.tsx с тремя отдельными линиями и легендой). Здесь — ОДНА линия,
// среднее по трём измерениям за день, без осей и сетки: минимальный, немедицинский вид.
// Никаких пропущенных дней не достраиваем — рисуем ровно те точки, что вернул бэкенд.
export interface SparklineEntry {
  date: string;
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
}

const WIDTH = 300;
const HEIGHT = 64;
const PAD_X = 6;
const PAD_Y = 10;

function average(entry: SparklineEntry): number {
  return (entry.sleepScore + entry.moodScore + entry.memoryScore) / 3;
}

function scaleX(index: number, count: number): number {
  if (count <= 1) return WIDTH / 2;
  return PAD_X + (index * (WIDTH - PAD_X * 2)) / (count - 1);
}

// Оценки 1-10 -> координата Y (в SVG y растёт вниз, инвертируем).
function scaleY(avg: number): number {
  const t = (avg - 1) / 9;
  return HEIGHT - PAD_Y - t * (HEIGHT - PAD_Y * 2);
}

function buildPath(entries: SparklineEntry[]): string {
  return entries
    .map((entry, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i, entries.length)} ${scaleY(average(entry))}`)
    .join(' ');
}

export default function MiniSparkline({ entries }: { entries: SparklineEntry[] }) {
  if (entries.length < 2) {
    return (
      <div className="sw-sparkline-card">
        <p className="sw-sparkline-empty">
          Динамика появится после двух отметок за неделю.
        </p>
      </div>
    );
  }

  return (
    <div className="sw-sparkline-card">
      <p className="sw-sparkline-caption">Среднее ваших отметок</p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label="Среднее ваших отметок сна, настроения и головы за последние 7 дней"
      >
        <path
          d={buildPath(entries)}
          fill="none"
          stroke="var(--sw-primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {entries.map((entry, i) => (
          <circle key={entry.date} cx={scaleX(i, entries.length)} cy={scaleY(average(entry))} r={3} fill="var(--sw-primary)" />
        ))}
      </svg>
    </div>
  );
}
