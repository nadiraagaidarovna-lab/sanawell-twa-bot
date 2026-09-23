// CheckinScreen.tsx — Срез 5: тёплое текстовое подтверждение + «Исправить» в течение
// 24 часов (ТЗ 6.3.3/6.3.4). При загрузке экран спрашивает бэкенд, есть ли уже чек-ин
// за сегодня — если да, сразу показывает подтверждение вместо пустой формы (иначе
// повторный визит в тот же день выглядел бы так, будто чек-ин потерялся).
//
// Режим embedded (срез «чек-ин на главный экран»): тот же экран, но без своей обёртки
// <main>/заголовка страницы — HomeScreen.tsx вставляет его прямо в главный экран, чтобы
// загрузка и исправление отметки сохраняют прежнее поведение. На форме закреплённая
// панель сохранения заменяет нативную MainButton только для Check-in.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { hapticFeedbackNotificationOccurred } from '@telegram-apps/sdk';
import NumericSelector from '../components/NumericSelector';
import HotFlashesSelector from '../components/HotFlashesSelector';
import { HOT_FLASHES_LABELS, type HotFlashes } from '../content/checkin';
import { useMainButton } from '../lib/useMainButton';
import { apiFetch } from '../lib/api';
import './CheckinScreen.css';

export interface CheckinRecord {
  sleepScore: number;
  moodScore: number;
  memoryScore: number;
  comment: string | null;
  energyScore: number | null;
  hot_flashes: HotFlashes | null;
  canCorrect: boolean;
}

type ViewState = 'loading' | 'form' | 'confirmed';
type SubmitState = 'idle' | 'submitting' | 'error';

interface CheckinScreenProps {
  embedded?: boolean;
  /** Вызывается после успешной отправки — главный экран обновляет блок «Мой прогресс». */
  onSaved?: (checkin: CheckinRecord) => void;
  onFormActiveChange?: (active: boolean) => void;
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

export default function CheckinScreen({ embedded = false, onSaved, onFormActiveChange }: CheckinScreenProps) {
  const [view, setView] = useState<ViewState>('loading');
  const [saved, setSaved] = useState<CheckinRecord | null>(null);

  const [sleep, setSleep] = useState(5);
  const [mood, setMood] = useState(5);
  const [memory, setMemory] = useState(5);
  const [comment, setComment] = useState('');
  const [energy, setEnergy] = useState<number | null>(null);
  const [hotFlashes, setHotFlashes] = useState<HotFlashes | null>(null);

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const submitting = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const [answered, setAnswered] = useState({ sleep: false, mood: false, memory: false });
  const unanswered = [!answered.sleep && 'Сон', !answered.mood && 'Настроение', !answered.memory && 'Ясность'].filter(Boolean);
  const canSave = unanswered.length === 0;

  useEffect(() => {
    onFormActiveChange?.(view === 'form');
    return () => onFormActiveChange?.(false);
  }, [view, onFormActiveChange]);

  useEffect(() => {
    if (view !== 'form' || !panel.current || !spacer.current) return;
    const bar = panel.current;
    const space = spacer.current;
    const viewport = window.visualViewport;
    const updateHeight = () => { space.style.height = `${bar.getBoundingClientRect().height + 16}px`; };
    const updatePosition = () => {
      const offset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      bar.style.setProperty('--checkin-keyboard-offset', `${offset}px`);
    };
    const resizeViewport = () => {
      updatePosition();
      const focused = document.activeElement;
      if (focused instanceof HTMLTextAreaElement && space.parentElement?.contains(focused)) {
        const overlap = focused.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 16;
        if (overlap > 0) window.scrollBy(0, overlap);
      }
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bar);
    updateHeight();
    updatePosition();
    viewport?.addEventListener('resize', resizeViewport);
    viewport?.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', resizeViewport);
    return () => {
      observer.disconnect();
      viewport?.removeEventListener('resize', resizeViewport);
      viewport?.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', resizeViewport);
    };
  }, [view]);

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
    // Synchronous guard also covers two taps before React renders the disabled state.
    if (submitting.current || view !== 'form' || !canSave) return;
    submitting.current = true;
    setSubmitState('submitting');

    try {
      const { checkin } = await apiFetch<{ ok: true; checkin: CheckinRecord }>('/checkin', {
        method: 'POST',
        body: JSON.stringify({ sleep, mood, memory, energy, hot_flashes: hotFlashes, comment: comment.trim() || undefined }),
      });
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('success');
      }
      setSaved(checkin);
      setView('confirmed');
      setSubmitState('idle');
      onSaved?.(checkin);
    } catch {
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('error');
      }
      setSubmitState('error');
    } finally {
      submitting.current = false;
    }
  };

  const handleEdit = () => {
    if (saved) {
      setSleep(saved.sleepScore);
      setMood(saved.moodScore);
      setMemory(saved.memoryScore);
      setComment(saved.comment ?? '');
      setEnergy(saved.energyScore ?? null);
      setHotFlashes(saved.hot_flashes ?? null);
      setAnswered({ sleep: true, mood: true, memory: true });
    }
    setView('form');
  };

  useMainButton({
    text: 'Отправить',
    onClick: handleSubmit,
    isEnabled: canSave && submitState !== 'submitting',
    isLoaderVisible: submitState === 'submitting',
    isVisible: false,
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
          Записала: сон {saved.sleepScore}, настроение {saved.moodScore}, ясность / концентрация{' '}
          {saved.memoryScore}
          {saved.comment ? ' — и то, что вы написали, тоже сохранила.' : '.'}
        </p>
        <p className="body-text">Энергия: {saved.energyScore ?? 'не отмечено'}. Приливы и ночная потливость: {saved.hot_flashes ? HOT_FLASHES_LABELS[saved.hot_flashes] : 'не отмечено'}.</p>
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
      <fieldset className="checkin-fields" disabled={submitState === 'submitting'} aria-label="Ответы Check-in 360°">
      <div className="scales">
        <NumericSelector label="Сон" hint="пробуждения, бессонница" value={answered.sleep ? sleep : null} onChange={(value) => {
          setSleep(value); setAnswered((prev) => ({ ...prev, sleep: true }));
        }} />
        <NumericSelector label="Энергия" hint="Как вы оцениваете свою энергию сегодня?" value={energy} onChange={setEnergy} />
        <NumericSelector
          label="Настроение"
          hint="тревога, раздражительность"
          value={answered.mood ? mood : null}
          onChange={(value) => { setMood(value); setAnswered((prev) => ({ ...prev, mood: true })); }}
        />
        <NumericSelector
          label="Ясность / концентрация"
          hint="туман, рассеянность"
          value={answered.memory ? memory : null}
          onChange={(value) => { setMemory(value); setAnswered((prev) => ({ ...prev, memory: true })); }}
        />
        <HotFlashesSelector value={hotFlashes} onChange={setHotFlashes} />
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
      </fieldset>
      <div ref={spacer} aria-hidden="true" />
      <div ref={panel} className="checkin-save-panel" aria-label="Сохранение отметки">
        <div className="checkin-save-inner">
          <p id="checkin-save-status" role="status" aria-live="polite">
            {submitState === 'error' ? 'Не удалось сохранить. Попробуйте ещё раз'
              : submitState === 'submitting' ? 'Сохраняем ваши ответы'
              : canSave ? 'Ответы готовы к сохранению'
              : `Отметьте, пожалуйста: ${unanswered.join(', ')}.`}
          </p>
          <button type="button" className="checkin-save-button" onClick={handleSubmit}
            disabled={!canSave || submitState === 'submitting'} aria-describedby="checkin-save-status"
            aria-busy={submitState === 'submitting'}>
            {submitState === 'submitting' && <span className="checkin-save-spinner" aria-hidden="true" />}
            {submitState === 'submitting' ? 'Сохраняем…' : 'Сохранить отметку'}
          </button>
        </div>
      </div>
    </Shell>
  );
}
