// ProgressScreen.tsx — «Мой путь» на /checkin/ (Срез А1, ТЗ 5.2/6.4 — минимальная версия,
// см. CLAUDE.md): история чек-инов за последние 14 дней, только из daily_checkins (реальные
// оценки 1–10, а не бинарная сетка старого маршрута /). Без графика и подбора техник —
// это отдельный следующий срез, если/когда подтверждён.
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';

interface HistoryEntry {
  date: string;
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
  comment: string | null;
}

type ViewState = 'loading' | 'loaded' | 'error';

const MONTHS_RU = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(day)} ${MONTHS_RU[Number(month) - 1]}`;
}

export default function ProgressScreen() {
  const [view, setView] = useState<ViewState>('loading');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ history: HistoryEntry[] }>('/checkin/history?days=14')
      .then(({ history: rows }) => {
        if (cancelled) return;
        setHistory(rows);
        setView('loaded');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'Сеть недоступна');
        setView('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Мой путь</h1>
      <p className="body-text">Ваши отметки за последние 14 дней.</p>

      {view === 'loading' && (
        <p className="body-text" style={{ color: 'var(--hint)' }}>
          Загружаю…
        </p>
      )}

      {view === 'error' && (
        <p className="body-text" style={{ color: 'var(--sw-terracotta)' }}>
          Не удалось загрузить: {error}
        </p>
      )}

      {view === 'loaded' && history.length === 0 && (
        <p className="body-text" style={{ color: 'var(--hint)' }}>
          Пока нет ни одной записи за этот период — отметки появятся здесь после первого чек-ина.
        </p>
      )}

      {view === 'loaded' && history.length > 0 && (
        <div className="history-list">
          {history
            .slice()
            .reverse()
            .map((entry) => (
              <div className="history-row" key={entry.date}>
                <span className="history-date">{formatDate(entry.date)}</span>
                <span className="history-scores">
                  Сон {entry.sleepScore} · Настроение {entry.moodScore} · Голова{' '}
                  {entry.memoryScore}
                </span>
                {entry.comment && <p className="history-comment">{entry.comment}</p>}
              </div>
            ))}
        </div>
      )}
    </main>
  );
}
