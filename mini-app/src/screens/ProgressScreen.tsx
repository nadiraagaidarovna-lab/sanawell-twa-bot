// ProgressScreen.tsx — «Мой путь» на /checkin/ (ТЗ 5.2/6.4). Срез А1 добавил минимальную
// версию (список истории); Срез Е2 достраивает полную версию поверх того же
// /api/checkin/history: график недели + подобранные по паттерну техники + приглашение
// к врачу (данные для двух последних — отдельный эндпоинт /api/checkin/weekly-report,
// см. Срез Е1, — намеренно не дублирует дневные оценки, которые уже есть в history).
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import WeeklyChart, { type WeeklyChartEntry } from '../components/WeeklyChart';

interface HistoryEntry {
  date: string;
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
  comment: string | null;
}

interface Protocol {
  id: string;
  title: string;
  duration: string;
  steps: string[];
  note: string;
}

interface Recommendation {
  dimension: string;
  reason: string;
  protocol: Protocol;
}

interface WeeklyReport {
  recommendations: Recommendation[];
  doctorNudge: { show: boolean; text: string | null };
}

type ViewState = 'loading' | 'loaded' | 'error';
type ReportState = 'loading' | 'loaded' | 'error';

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

  const [reportState, setReportState] = useState<ReportState>('loading');
  const [report, setReport] = useState<WeeklyReport | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    apiFetch<WeeklyReport>('/checkin/weekly-report')
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setReportState('loaded');
      })
      .catch(() => {
        // Не блокируем весь экран, если подбор техник не загрузился — список истории
        // ниже и так самодостаточен, это дополнительный, не критичный блок.
        if (!cancelled) setReportState('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const weekEntries: WeeklyChartEntry[] = history.slice(-7);

  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Мой путь</h1>

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

      {view === 'loaded' && (
        <>
          <p className="module-heading">Эта неделя</p>
          <WeeklyChart entries={weekEntries} />

          {reportState === 'loaded' && report && report.recommendations.length > 0 && (
            <div className="protocol-list">
              {report.recommendations.map((rec) => (
                <div className="protocol-card" key={rec.protocol.id}>
                  <p className="protocol-reason">{rec.reason}</p>
                  <div className="protocol-card-header">
                    <span className="protocol-title">{rec.protocol.title}</span>
                    <span className="protocol-duration">{rec.protocol.duration}</span>
                  </div>
                  <ol className="protocol-steps">
                    {rec.protocol.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <p className="protocol-note">{rec.protocol.note}</p>
                </div>
              ))}
            </div>
          )}

          {reportState === 'loaded' && report?.doctorNudge.show && (
            <div className="doctor-nudge">{report.doctorNudge.text}</div>
          )}

          <p className="module-heading">Все записи за 14 дней</p>

          {history.length === 0 && (
            <p className="body-text" style={{ color: 'var(--hint)' }}>
              Пока нет ни одной записи за этот период — отметки появятся здесь после первого чек-ина.
            </p>
          )}

          {history.length > 0 && (
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
        </>
      )}
    </main>
  );
}
