// ProgressHook.tsx — короткий блок «Мой прогресс» на главном экране (ретеншн-крючок: женщина
// видит свою регулярность сразу на входе, а не только в «Личном кабинете»). Те же данные и
// та же нейтральная формулировка, что в кабинете (GET /api/checkin/summary), тап ведёт на
// «Самочувствие». Пока записей нет — не показывается вовсе. Оценочных фраз нет намеренно.
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useNavigation } from '../lib/useNavigation';
import { formatDate, pluralDays } from '../lib/progressFormat';

interface SummaryResponse {
  daysCount: number;
  lastCheckinDate: string | null;
}

interface ProgressHookProps {
  /** Меняется после отправки чек-ина на этом же экране — чтобы счётчик обновился сразу. */
  refreshKey: number;
}

export default function ProgressHook({ refreshKey }: ProgressHookProps) {
  const { push } = useNavigation();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<SummaryResponse>('/checkin/summary')
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        // Необязательный блок — при ошибке сети просто не показываем.
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!summary || summary.daysCount === 0) return null;

  return (
    <button type="button" className="progress-hook" onClick={() => push('progress')}>
      <span className="progress-hook-main">
        Вы ведёте наблюдения {summary.daysCount} {pluralDays(summary.daysCount)}
      </span>
      {summary.lastCheckinDate && (
        <span className="progress-hook-sub">Последняя запись — {formatDate(summary.lastCheckinDate)}</span>
      )}
    </button>
  );
}
