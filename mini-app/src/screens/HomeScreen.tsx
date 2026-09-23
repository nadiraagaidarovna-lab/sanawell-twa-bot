// Approved Home hierarchy: docs/sanawell/03_HOME_SPEC.md.
import { useEffect, useState } from 'react';
import { useNavigation } from '../lib/useNavigation';
import { apiFetch } from '../lib/api';
import { getTelegramFirstName } from '../lib/telegram';
import logo from '../assets/sanawell-logo.png';
import BottomNav from '../components/BottomNav';
import CheckinScreen, { type CheckinRecord } from './CheckinScreen';
import StateCard from '../components/home/StateCard';
import type { SparklineEntry } from '../components/home/MiniSparkline';
import InsightCard from '../components/home/InsightCard';
import TodayActionCard from '../components/home/TodayActionCard';
import WellnessGrid from '../components/home/WellnessGrid';

interface TodayCheckin {
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
}
interface Recommendation {
  reason: string;
  protocol: { id: string; title: string; duration: string };
}
interface WeeklyReportResponse {
  recommendations: Recommendation[];
}

// Existing backend observations, excluding questionnaire goals and content rotation.
const REAL_OBSERVATION_MARKER = 'чек-ином на этой неделе';

function timeGreeting(hour: number): string {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export default function HomeScreen({ onCheckinSaved }: { onCheckinSaved: (checkin: CheckinRecord) => void }) {
  const { push } = useNavigation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(true);
  const [checkinError, setCheckinError] = useState(false);
  const [todayCheckin, setTodayCheckin] = useState<TodayCheckin | null>(null);
  const [weekHistory, setWeekHistory] = useState<SparklineEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [report, setReport] = useState<WeeklyReportResponse | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ displayName: string | null }>('/me')
      .then((me) => {
        if (!cancelled) setDisplayName(me.displayName?.trim() || null);
      })
      .catch(() => { /* Telegram name or a nameless greeting remains available. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ checkin: TodayCheckin | null }>('/checkin')
      .then(({ checkin }) => {
        if (!cancelled) {
          setTodayCheckin(checkin);
          setCheckinError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTodayCheckin(null);
          setCheckinError(true);
        }
      })
      .finally(() => { if (!cancelled) setCheckinLoading(false); });
    apiFetch<{ history: SparklineEntry[] }>('/checkin/history?days=7')
      .then(({ history }) => { if (!cancelled) setWeekHistory(history); })
      .catch(() => { if (!cancelled) setWeekHistory([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    apiFetch<WeeklyReportResponse>('/checkin/weekly-report')
      .then((data) => { if (!cancelled) setReport(data); })
      .catch(() => { if (!cancelled) setReport(null); })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleCheckinSaved = (checkin: CheckinRecord) => {
    setCheckinOpen(false);
    setCheckinLoading(true);
    setHistoryLoading(true);
    setReportLoading(true);
    setRefreshKey((n) => n + 1);
    onCheckinSaved(checkin);
  };

  const name = displayName || getTelegramFirstName();
  const greeting = `${timeGreeting(new Date().getHours())}${name ? `, ${name}` : ''}!`;
  const observation = report?.recommendations.find((rec) =>
    rec.reason.includes(REAL_OBSERVATION_MARKER))?.reason ?? null;
  const action = report?.recommendations[0]?.protocol ?? null;

  return (
    <main className="sw-home">
      <header className="sw-home-header">
        <img src={logo} alt="SanaWell AI" className="sw-home-logo" />
        <h1 className="sw-greeting">{greeting}</h1>
      </header>

      <StateCard loading={checkinLoading} error={checkinError} checkin={todayCheckin}
        history={weekHistory} historyLoading={historyLoading} />

      <button type="button" className="sw-cta-primary"
        aria-expanded={checkinOpen} aria-controls="home-checkin"
        onClick={() => setCheckinOpen((open) => !open)}>
        Отметить самочувствие
      </button>
      {checkinOpen && (
        <div className="sw-checkin-inline" id="home-checkin">
          <CheckinScreen embedded onSaved={handleCheckinSaved} />
        </div>
      )}

      <InsightCard loading={reportLoading} observationText={observation}
        onSeeMore={() => push('progress')} />

      <TodayActionCard loading={reportLoading} title={action?.title ?? 'Все техники самопомощи'}
        duration={action?.duration} onStart={() => push('techniques')} />

      <section className="sw-section" aria-label="Сферы заботы о себе">
        <WellnessGrid onNavigate={(screen) => push(screen)} />
      </section>
      <BottomNav active="home" />
    </main>
  );
}
