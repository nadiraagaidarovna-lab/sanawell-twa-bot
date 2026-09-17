// ProgressScreen.tsx — «Мой путь» на /checkin/ (ТЗ 5.2/6.4). Срез А1 добавил минимальную
// версию (список истории); Срез Е2 достраивает полную версию поверх того же
// /api/checkin/history: график недели + подобранные по паттерну техники + приглашение
// к врачу (данные для двух последних — отдельный эндпоинт /api/checkin/weekly-report,
// см. Срез Е1, — намеренно не дублирует дневные оценки, которые уже есть в history).
// Срез Д, Промпт 3/5 (ТЗ 4.4.1): это экран, на который ведёт папка «Самочувствие» —
// переведён на пудровую v2-тему (v2-screen + v2-accent-c6) + нижняя навигация, заголовок
// стал "Самочувствие" (только текст — ID экрана 'progress' и имя файла не менялись). Ни
// GET /api/checkin/history, ни GET /api/checkin/weekly-report, ни логика подбора техник
// не менялись.
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useNavigation } from '../lib/useNavigation';
import WeeklyChart, { type WeeklyChartEntry } from '../components/WeeklyChart';
import BottomNav from '../components/BottomNav';

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
  const { push } = useNavigation();
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
    <main className="screen v2-screen v2-accent-c6">
      <p className="eyebrow">SanaWell</p>
      <h1>Самочувствие</h1>

      {view === 'loading' && (
        <p className="body-text" style={{ color: 'var(--v2-ink-soft)' }}>
          Загружаю…
        </p>
      )}

      {view === 'error' && (
        <p className="body-text" style={{ color: 'var(--v2-terracotta)' }}>
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
            <div className="doctor-nudge">
              <p style={{ margin: '0 0 10px' }}>{report.doctorNudge.text}</p>
              <button type="button" className="btn-secondary" onClick={() => push('partners')}>
                Запись к врачу
              </button>
            </div>
          )}

          <p className="module-heading">Все записи за 14 дней</p>

          {history.length === 0 && (
            <p className="body-text" style={{ color: 'var(--v2-ink-soft)' }}>
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

      <BottomNav active="progress" />
    </main>
  );
}
