// ActionFeedback.tsx — «Попробовала / Пока нет» under the material opened from today's action, then
// the end of today. Opening the material alone is never recorded as done.
import { useState } from 'react';
import { markTodayAction, type TodayMaterial } from '../lib/todayAction';
import './TodayActionPanel.css';

export default function ActionFeedback({ material, onFinish }: { material: TodayMaterial; onFinish: () => void }) {
  const [state, setState] = useState<'idle' | 'saving' | 'tried' | 'not_yet' | 'error'>('idle');
  const mark = async (status: 'tried' | 'not_yet') => {
    setState('saving');
    try {
      await markTodayAction(material.id, status);
      setState(status);
    } catch {
      setState('error');
    }
  };
  return (
    <section className="sw-today sw-today-feedback" aria-label="Отметка на сегодня">
      {(state === 'idle' || state === 'saving' || state === 'error') && <>
        <p className="sw-today-title">Получилось попробовать?</p>
        <div className="sw-today-feedback-buttons">
          <button type="button" className="sw-today-open" disabled={state === 'saving'} onClick={() => mark('tried')}>Попробовала</button>
          <button type="button" className="sw-today-secondary" disabled={state === 'saving'} onClick={() => mark('not_yet')}>Пока нет</button>
        </div>
        {state === 'error' && <p className="sw-today-note" role="alert">Не удалось сохранить. Попробуйте ещё раз.</p>}
      </>}
      {state === 'tried' && <p className="sw-today-done" role="status">Отлично. На сегодня всё 🤍 Возвращайтесь завтра — отметьте самочувствие.</p>}
      {state === 'not_yet' && <p className="sw-today-note" role="status">Хорошо, можно вернуться к этому позже. На сегодня всё 🤍</p>}
      {(state === 'tried' || state === 'not_yet') && <button type="button" className="sw-today-secondary" onClick={onFinish}>На главную</button>}
    </section>
  );
}
