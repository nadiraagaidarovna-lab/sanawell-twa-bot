// HomeScreen.tsx — главный экран v3 (TASK 01: одобренный UX/UI-редизайн Home, брифинг
// «REFACTOR THE EXISTING APP», не переписывание с нуля). Заменяет прежнюю сетку из 5
// иллюстрированных SVG-папок (Срез Д) на: hero «Моё состояние» → встроенный чек-ин по
// требованию → недельный спарклайн → «Мы заметили» → «Сегодня для вас» → сетка «6 сфер
// заботы о себе» → второстепенный вход в «Запись к врачу» → BottomNav.
//
// Что НЕ изменилось: логика чек-ина (CheckinScreen.tsx — тот же embedded-режим, что и
// раньше, тот же upsert/24ч-редактирование/haptics/MainButton), сами 5 существующих
// назначений (techniques/guide/body/partners/progress), BottomNav.tsx (в этом срезе не
// трогается по прямому решению — редизайн навигации отдельной задачей), initData-гейт в
// App.tsx. Блок «Мой прогресс» (ProgressHook.tsx, счётчик дней всего) с главного экрана
// убран — в новой иерархии Home его функцию частично закрывает недельный спарклайн, а
// сам счётчик дней всего по-прежнему доступен в «Личном кабинете»; компонент не удалён.
import { useEffect, useState } from 'react';
import { useNavigation } from '../lib/useNavigation';
import { apiFetch } from '../lib/api';
import { getTelegramFirstName } from '../lib/telegram';
import BottomNav from '../components/BottomNav';
import CheckinScreen from './CheckinScreen';
import StateCard from '../components/home/StateCard';
import MiniSparkline, { type SparklineEntry } from '../components/home/MiniSparkline';
import InsightCard from '../components/home/InsightCard';
import TodayActionCard from '../components/home/TodayActionCard';
import WellnessGrid from '../components/home/WellnessGrid';

interface TodayCheckin {
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
}

interface Protocol {
  id: string;
  title: string;
  duration: string;
}

interface Recommendation {
  dimension: string;
  reason: string;
  protocol: Protocol;
}

interface WeeklyReportResponse {
  recommendations: Recommendation[];
}

// Только у "настоящих" наблюдений по паттерну недели (сон/настроение/голова просели N из M
// дней с чек-ином — см. backend/src/weeklyReport.js, DIMENSIONS[].reason) в тексте есть эта
// фраза. У reason цели из анкеты (GOAL_REASON) и фоновой ротации питания/силовых
// (ROTATION_REASON) её нет — те не являются наблюдением по данным чек-ина, показывать их
// под заголовком "Мы заметили" было бы введением в заблуждение.
const REAL_OBSERVATION_MARKER = 'чек-ином на этой неделе';

function timeGreeting(hour: number): string {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export default function HomeScreen() {
  const { push } = useNavigation();

  // Растёт при успешном сохранении чек-ина — перезапускает все три fetch ниже, чтобы hero/
  // спарклайн/наблюдение обновились сразу, без перезахода в приложение.
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const [checkinLoading, setCheckinLoading] = useState(true);
  const [todayCheckin, setTodayCheckin] = useState<TodayCheckin | null>(null);

  const [weekHistory, setWeekHistory] = useState<SparklineEntry[]>([]);

  const [reportLoading, setReportLoading] = useState(true);
  const [report, setReport] = useState<WeeklyReportResponse | null>(null);

  // Существующая утилита (lib/telegram.ts, уже используется Шагом 1 анкеты) — читает
  // first_name из той же initData, что уходит на бэкенд. Если недоступно — существующий
  // фоллбэк: приветствие без имени (тем же паттерном, что и раньше был безусловный
  // "Здравствуйте" на этом экране).
  const firstName = getTelegramFirstName();
  const greeting = `${timeGreeting(new Date().getHours())}${firstName ? `, ${firstName}` : ''}!`;

  useEffect(() => {
    let cancelled = false;
    setCheckinLoading(true);
    apiFetch<{ checkin: TodayCheckin | null }>('/checkin')
      .then(({ checkin }) => {
        if (!cancelled) setTodayCheckin(checkin);
      })
      .catch(() => {
        if (!cancelled) setTodayCheckin(null);
      })
      .finally(() => {
        if (!cancelled) setCheckinLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ history: SparklineEntry[] }>('/checkin/history?days=7')
      .then(({ history }) => {
        if (!cancelled) setWeekHistory(history);
      })
      .catch(() => {
        // Необязательный блок — при сетевой ошибке спарклайн просто покажет пустое
        // состояние (entries.length < 2), недостающие точки не выдумываем.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setReportLoading(true);
    apiFetch<WeeklyReportResponse>('/checkin/weekly-report')
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleCheckinSaved = () => {
    setCheckinOpen(false);
    setRefreshKey((n) => n + 1);
  };

  const realObservation =
    report?.recommendations.find((rec) => rec.reason.includes(REAL_OBSERVATION_MARKER))?.reason ?? null;

  const todayAction = report?.recommendations[0] ?? null;

  return (
    <main className="sw-home">
      <header className="sw-home-header">
        <p className="sw-eyebrow">SanaWell</p>
        <h1 className="sw-greeting">{greeting}</h1>
        <p className="sw-subgreeting">Как вы сегодня?</p>
      </header>

      <StateCard
        loading={checkinLoading}
        checkin={todayCheckin}
        onOpenCheckin={() => setCheckinOpen((v) => !v)}
      />

      {checkinOpen && (
        <div className="sw-checkin-inline">
          <CheckinScreen embedded onSaved={handleCheckinSaved} />
        </div>
      )}

      <section className="sw-section">
        <h2 className="sw-section-title">Эта неделя</h2>
        <MiniSparkline entries={weekHistory} />
      </section>

      <InsightCard
        loading={reportLoading}
        observationText={realObservation}
        onSeeMore={() => push('progress')}
      />

      {!reportLoading && todayAction && (
        <TodayActionCard
          title={todayAction.protocol.title}
          duration={todayAction.protocol.duration}
          onStart={() => push('techniques')}
        />
      )}

      <section className="sw-section">
        <h2 className="sw-section-title">6 сфер заботы о себе</h2>
        <WellnessGrid onNavigate={(screen) => push(screen)} />
      </section>

      <button type="button" className="sw-support-link" onClick={() => push('partners')}>
        <span className="sw-support-text">Нужна дополнительная поддержка?</span>
        <span className="sw-support-cta">Найти специалиста →</span>
      </button>

      <BottomNav active="home" />
    </main>
  );
}
