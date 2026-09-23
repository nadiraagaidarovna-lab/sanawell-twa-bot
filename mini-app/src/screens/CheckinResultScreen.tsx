import { useEffect, useRef, useState } from 'react';
import logo from '../assets/sanawell-logo.png';
import { HOT_FLASHES_LABELS } from '../content/checkin';
import { apiFetch } from '../lib/api';
import type { CheckinRecord } from './CheckinScreen';
import './CheckinResultScreen.css';

interface Props {
  checkin: CheckinRecord;
  onDone: () => void;
  onProgress: () => void;
}

// Each dimension has its own equal 80-degree scale, separated by a 10-degree gap.
function arc(start: number, sweep: number): string {
  const point = (angle: number) => {
    const radians = angle * Math.PI / 180;
    return `${160 + 148 * Math.cos(radians)} ${160 + 148 * Math.sin(radians)}`;
  };
  return `M ${point(start)} A 148 148 0 0 1 ${point(start + sweep)}`;
}

export default function CheckinResultScreen({ checkin, onDone, onProgress }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [summary, setSummary] = useState<{ daysCount: number; lastCheckinDate: string | null } | null>(null);
  const [submittedAt] = useState(() => new Date());

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
    let cancelled = false;
    // All-time count: a short history window cannot establish a first check-in.
    apiFetch<{ daysCount: number; lastCheckinDate: string | null }>('/checkin/summary')
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch(() => { /* Unknown history must not be presented as a first check-in. */ });
    return () => { cancelled = true; };
  }, []);

  const date = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Almaty',
  }).format(summary?.lastCheckinDate
    ? new Date(`${summary.lastCheckinDate.slice(0, 10)}T12:00:00+05:00`) : submittedAt);
  const dimensions = [
    { label: 'Сон', icon: '🌙', value: checkin.sleepScore, start: 185 },
    { label: 'Энергия', icon: '⚡', value: checkin.energyScore, start: 275 },
    { label: 'Настроение', icon: '💜', value: checkin.moodScore, start: 95 },
    { label: 'Ясность', icon: '🧠', value: checkin.memoryScore, start: 5 },
  ];

  return (
    <main className="sw-result">
      <header className="sw-result-header">
        <img src={logo} alt="SanaWell AI" width="64" height="64" />
        <h1 ref={heading} tabIndex={-1}>Моя Карта самочувствия 360°</h1>
        <p>Сегодня · {date}</p>
      </header>

      <section className="sw-result-map" aria-label="Ваши сохранённые отметки за сегодня">
        <svg className="sw-result-arcs" viewBox="0 0 320 320" aria-hidden="true">
          {dimensions.map(({ label, value, start }) => (
            <g key={label}>
              <path className="sw-result-track" d={arc(start, 80)} />
              {value !== null && <path className="sw-result-arc" d={arc(start, 80 * value / 10)} />}
            </g>
          ))}
        </svg>
        <span className="sw-result-center" aria-hidden="true">Сегодня</span>
        <dl className="sw-result-values">
          {dimensions.map(({ label, icon, value }) => (
            <div key={label} className="sw-result-dimension">
              <dt><span aria-hidden="true">{icon}</span> {label}</dt>
              <dd>{value === null ? <span className="sw-result-missing">Не отмечено</span> : <>{value}<span>/10</span></>}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="sw-result-flashes"><span aria-hidden="true">🔥</span> Приливы — <strong>{checkin.hot_flashes === null ? 'Не отмечено' : HOT_FLASHES_LABELS[checkin.hot_flashes]}</strong></p>

      <p className="sw-result-first">
        {summary?.daysCount === 1 && <strong>Это ваша первая отметка ♡</strong>}
        <strong>Готово на сегодня 🤍</strong>
        Возвращайтесь завтра и снова отметьте самочувствие.<br />
        Чем больше ваших отметок, тем понятнее становится ваша личная динамика.
      </p>

      <footer className="sw-result-actions">
        <button type="button" onClick={onDone}>Готово</button>
        <button type="button" className="sw-result-secondary" onClick={onProgress}>Посмотреть динамику</button>
      </footer>
    </main>
  );
}
