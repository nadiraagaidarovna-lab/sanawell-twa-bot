// TodayActionPanel.tsx — «Сегодня для вас» on the wellbeing map and on Home: one concrete existing
// material with the reason it was chosen, «Сегодня хочу другую тему» (today only, the main priority
// stays), and a topic choice when there is no usable priority.
import { useEffect, useState } from 'react';
import { chooseTodayTopic, loadTodayAction, type TodayAction, type TodayMaterial } from '../lib/todayAction';
import './TodayActionPanel.css';

export default function TodayActionPanel({ onOpen }: { onOpen: (material: TodayMaterial) => void }) {
  const [action, setAction] = useState<TodayAction | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTodayAction()
      .then((data) => { if (!cancelled) { setAction(data); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, []);

  const pick = async (topic: string) => {
    setSaving(true); setSaveError(false);
    try {
      setAction(await chooseTodayTopic(topic));
      setChoosing(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const topics = (exclude?: string) => action && <div className="sw-today-topics" role="group" aria-label="Темы на сегодня">
    {action.options.filter((o) => o.key !== exclude).map((o) => (
      <button type="button" key={o.key} disabled={saving} onClick={() => pick(o.key)}>{o.title}</button>
    ))}
  </div>;

  return (
    <section className="sw-today" aria-labelledby="today-action-title">
      <h2 id="today-action-title" className="sw-today-heading">Сегодня для вас</h2>
      {state === 'loading' && <p className="sw-today-note">Загружаю…</p>}
      {state === 'error' && <p className="sw-today-note" role="alert">Не удалось загрузить. Попробуйте открыть позже.</p>}
      {state === 'ready' && action && (action.needsTopic ? <>
        <p className="sw-today-note">Выберите тему на сегодня — подберём одно конкретное действие. Главную тему можно выбрать в профиле.</p>
        {topics()}
      </> : <>
        <p className="sw-today-topic">{action.topicTitle}</p>
        <p className="sw-today-title">{action.material.title}</p>
        {action.material.duration && <p className="sw-today-note">{action.material.duration}</p>}
        <p className="sw-today-reason">{action.reason}</p>
        {action.status === 'tried' && <p className="sw-today-done" role="status">Отмечено: попробовала. На сегодня всё 🤍 Возвращайтесь завтра.</p>}
        {action.status === 'not_yet' && <p className="sw-today-note" role="status">Отмечено: пока нет. Можно вернуться к этому позже.</p>}
        <button type="button" className="sw-today-open" onClick={() => onOpen(action.material)}>Открыть</button>
        {!choosing && <button type="button" className="sw-today-link" onClick={() => setChoosing(true)}>Сегодня хочу другую тему</button>}
        {choosing && <>
          <p className="sw-today-note">Только на сегодня — главная тема останется прежней.</p>
          {topics(action.topic)}
          <button type="button" className="sw-today-link" disabled={saving} onClick={() => setChoosing(false)}>Отмена</button>
        </>}
      </>)}
      {saveError && <p className="sw-today-note" role="alert">Не удалось сохранить. Попробуйте ещё раз.</p>}
    </section>
  );
}
