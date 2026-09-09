// CheckinScreen.tsx — Срез 5: тёплое текстовое подтверждение + «Исправить» в течение
// 24 часов (ТЗ 6.3.3/6.3.4). При загрузке экран спрашивает бэкенд, есть ли уже чек-ин
// за сегодня — если да, сразу показывает подтверждение вместо пустой формы (иначе
// повторный визит в тот же день выглядел бы так, будто чек-ин потерялся).
import { useEffect, useState } from 'react';
import { hapticFeedbackNotificationOccurred } from '@telegram-apps/sdk';
import ScaleSlider from '../components/ScaleSlider';
import { useMainButton } from '../lib/useMainButton';
import { apiFetch, ApiError } from '../lib/api';

interface CheckinRecord {
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
  comment: string | null;
  canCorrect: boolean;
}

type ViewState = 'loading' | 'form' | 'confirmed';
type SubmitState = 'idle' | 'submitting' | 'error';

export default function CheckinScreen() {
  const [view, setView] = useState<ViewState>('loading');
  const [saved, setSaved] = useState<CheckinRecord | null>(null);

  const [sleep, setSleep] = useState(5);
  const [mood, setMood] = useState(5);
  const [memory, setMemory] = useState(5);
  const [comment, setComment] = useState('');

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ checkin: CheckinRecord | null }>('/checkin')
      .then(({ checkin }) => {
        if (cancelled) return;
        if (checkin) {
          setSaved(checkin);
          setView('confirmed');
        } else {
          setView('form');
        }
      })
      .catch(() => {
        // Не удалось узнать, есть ли уже чек-ин за сегодня — не блокируем пользователя,
        // просто даём заполнить форму заново (крайний случай хуже дублирующей записи не будет:
        // POST ниже — upsert по дню, а не INSERT).
        if (!cancelled) setView('form');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    setSubmitState('submitting');
    setSubmitError(null);

    try {
      const { checkin } = await apiFetch<{ ok: true; checkin: CheckinRecord }>('/checkin', {
        method: 'POST',
        body: JSON.stringify({ sleep, mood, memory, comment: comment.trim() || undefined }),
      });
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('success');
      }
      setSaved(checkin);
      setView('confirmed');
      setSubmitState('idle');
    } catch (e) {
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('error');
      }
      setSubmitState('error');
      setSubmitError(e instanceof ApiError ? e.message : 'Сеть недоступна');
    }
  };

  const handleEdit = () => {
    if (saved) {
      setSleep(saved.sleepScore);
      setMood(saved.moodScore);
      setMemory(saved.memoryScore);
      setComment(saved.comment ?? '');
    }
    setView('form');
  };

  useMainButton({
    text: 'Отправить',
    onClick: handleSubmit,
    isEnabled: submitState !== 'submitting',
    isLoaderVisible: submitState === 'submitting',
    isVisible: view === 'form',
  });

  if (view === 'loading') {
    return (
      <main className="screen">
        <p className="eyebrow">SanaWell</p>
        <h1>Как вы сегодня?</h1>
        <p className="body-text" style={{ color: 'var(--hint)' }}>
          Загружаю…
        </p>
      </main>
    );
  }

  if (view === 'confirmed' && saved) {
    return (
      <main className="screen">
        <p className="eyebrow">SanaWell</p>
        <h1>Спасибо 🤍</h1>
        <p className="body-text">
          Записала: сон {saved.sleepScore}, настроение {saved.moodScore}, память{' '}
          {saved.memoryScore}
          {saved.comment ? ' — и то, что вы написали, тоже сохранила.' : '.'}
        </p>
        {saved.canCorrect && (
          <button type="button" className="btn-secondary" onClick={handleEdit}>
            Исправить
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Как вы сегодня?</h1>

      <div className="scales">
        <ScaleSlider label="Сон" hint="пробуждения, бессонница" value={sleep} onChange={setSleep} />
        <ScaleSlider
          label="Настроение"
          hint="тревога, раздражительность"
          value={mood}
          onChange={setMood}
        />
        <ScaleSlider
          label="Память"
          hint="туман в голове, забывчивость"
          value={memory}
          onChange={setMemory}
        />
      </div>

      <label className="comment-label" htmlFor="checkin-comment">
        Если хочется — опишите словами, что происходит (необязательно)
      </label>
      <textarea
        id="checkin-comment"
        className="comment-input"
        rows={3}
        placeholder="Если хочется — опишите словами, что происходит (необязательно)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      {submitState === 'error' && (
        <p className="body-text" style={{ color: 'var(--sw-terracotta)', fontSize: 13, marginTop: 14 }}>
          Не удалось сохранить: {submitError}
        </p>
      )}
    </main>
  );
}
