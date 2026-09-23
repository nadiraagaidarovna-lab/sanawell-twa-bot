// CheckinScreen.tsx — Срез 5: тёплое текстовое подтверждение + «Исправить» в течение
// 24 часов (ТЗ 6.3.3/6.3.4). При загрузке экран спрашивает бэкенд, есть ли уже чек-ин
// за сегодня — если да, сразу показывает подтверждение вместо пустой формы (иначе
// повторный визит в тот же день выглядел бы так, будто чек-ин потерялся).
//
// Режим embedded (срез «чек-ин на главный экран»): тот же экран, но без своей обёртки
// <main>/заголовка страницы — HomeScreen.tsx вставляет его прямо в главный экран, чтобы
// чек-ин был виден при открытии приложения, без промежуточного нажатия. Логика (загрузка
// «уже отправлен сегодня», отправка, «Исправить», MainButton «Отправить») не менялась;
// отдельный экран /checkin (папка «Как ты сегодня») работает как раньше.
import { useEffect, useState, type ReactNode } from 'react';
import { hapticFeedbackNotificationOccurred } from '@telegram-apps/sdk';
import NumericSelector from '../components/NumericSelector';
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

interface CheckinScreenProps {
  embedded?: boolean;
  /** Вызывается после успешной отправки — главный экран обновляет блок «Мой прогресс». */
  onSaved?: () => void;
}

function Shell({ embedded, title, children }: { embedded: boolean; title: string; children: ReactNode }) {
  if (embedded) {
    return (
      <section className="home-checkin">
        <h2 className="home-checkin-title">{title}</h2>
        {children}
      </section>
    );
  }
  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

export default function CheckinScreen({ embedded = false, onSaved }: CheckinScreenProps) {
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
      onSaved?.();
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
      <Shell embedded={embedded} title="Как вы сегодня?">
        <p className="body-text" style={{ color: embedded ? 'var(--v2-ink-soft)' : 'var(--hint)' }}>
          Загружаю…
        </p>
      </Shell>
    );
  }

  if (view === 'confirmed' && saved) {
    return (
      <Shell embedded={embedded} title="Спасибо 🤍">
        <p className="body-text">
          Записала: сон {saved.sleepScore}, настроение {saved.moodScore}, голова{' '}
          {saved.memoryScore}
          {saved.comment ? ' — и то, что вы написали, тоже сохранила.' : '.'}
        </p>
        {saved.canCorrect && (
          <button type="button" className="btn-secondary" onClick={handleEdit}>
            Исправить
          </button>
        )}
      </Shell>
    );
  }

  return (
    <Shell embedded={embedded} title="Как вы сегодня?">
      <div className="scales">
        <NumericSelector label="Сон" hint="пробуждения, бессонница" value={sleep} onChange={setSleep} />
        <NumericSelector
          label="Настроение"
          hint="тревога, раздражительность"
          value={mood}
          onChange={setMood}
        />
        <NumericSelector
          label="Голова"
          hint="туман, рассеянность"
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
    </Shell>
  );
}
