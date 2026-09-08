// CheckinScreen.tsx — Срез 4: реальная отправка на бэкенд (POST /api/checkin, ТЗ 5.1/6.3).
// Тёплое текстовое подтверждение и «Исправить» — Срез 5; здесь при успехе — только
// haptic-отклик (ТЗ 4.1), при ошибке — краткая строка с причиной, чтобы экран не выглядел
// сломанным при сетевой ошибке.
import { useState } from 'react';
import { hapticFeedbackNotificationOccurred } from '@telegram-apps/sdk';
import ScaleSlider from '../components/ScaleSlider';
import { useMainButton } from '../lib/useMainButton';
import { apiFetch, ApiError } from '../lib/api';

type SubmitState = 'idle' | 'submitting' | 'error';

export default function CheckinScreen() {
  const [sleep, setSleep] = useState(5);
  const [mood, setMood] = useState(5);
  const [memory, setMemory] = useState(5);
  const [comment, setComment] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitState('submitting');
    setSubmitError(null);

    try {
      await apiFetch('/checkin', {
        method: 'POST',
        body: JSON.stringify({ sleep, mood, memory, comment: comment.trim() || undefined }),
      });
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('success');
      }
      setSubmitState('idle');
      // Срез 5 добавит тёплое подтверждение ("Записала: сон 4, ...") и «Исправить» —
      // здесь пока намеренно ничего больше не меняется на экране при успехе.
    } catch (e) {
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('error');
      }
      setSubmitState('error');
      setSubmitError(e instanceof ApiError ? e.message : 'Сеть недоступна');
    }
  };

  useMainButton({
    text: 'Отправить',
    onClick: handleSubmit,
    isEnabled: submitState !== 'submitting',
    isLoaderVisible: submitState === 'submitting',
  });

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
        placeholder="Можно надиктовать голосовым вводом клавиатуры телефона…"
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
