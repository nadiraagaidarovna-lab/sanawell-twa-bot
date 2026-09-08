// CheckinScreen.tsx — Срез 3: реальный UI чек-ина (ТЗ 5.1/6.3). Значения живут в состоянии
// React и никуда не отправляются — сохранение в БД (POST /api/checkin) добавит Срез 4,
// тёплое текстовое подтверждение и «Исправить» — Срез 5. MainButton здесь пока только
// даёт тактильный отклик на нажатие (ТЗ 4.1), ничего не сохраняя.
import { useState } from 'react';
import { hapticFeedbackNotificationOccurred } from '@telegram-apps/sdk';
import ScaleSlider from '../components/ScaleSlider';
import { useMainButton } from '../lib/useMainButton';

export default function CheckinScreen() {
  const [sleep, setSleep] = useState(5);
  const [mood, setMood] = useState(5);
  const [memory, setMemory] = useState(5);
  const [comment, setComment] = useState('');

  useMainButton({
    text: 'Отправить',
    onClick: () => {
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('success');
      }
    },
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
    </main>
  );
}
