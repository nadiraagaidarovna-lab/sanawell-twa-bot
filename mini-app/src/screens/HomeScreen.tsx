// HomeScreen.tsx — корневой экран Mini App. "Начать чек-ин" — через нативный MainButton
// (ТЗ 4.1), а не кастомную кнопку. Реальный чек-ин появится на Срезе 3.
//
// Срез 2: при загрузке экран запрашивает GET /api/me у уже существующего бэкенда —
// это не новый бизнес-роут, а доказательство, что initData из React + @telegram-apps/sdk
// реально проходит HMAC-проверку requireTelegramAuth (backend/src/telegramAuth.js).
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useNavigation } from '../lib/useNavigation';
import { useMainButton } from '../lib/useMainButton';

interface MeResponse {
  onboarded: boolean;
  language: string | null;
  reminderOptIn: boolean;
}

type AuthStatus =
  | { state: 'loading' }
  | { state: 'ok'; me: MeResponse }
  | { state: 'error'; message: string };

type Lang = 'ru' | 'kk';

export default function HomeScreen() {
  const { push } = useNavigation();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ state: 'loading' });

  // Срез Г консолидации (CLAUDE.md 4.3.1) — временный контрол смены языка и напоминаний
  // прямо на /checkin/, поверх уже существующих /api/language и /api/reminder-opt-in.
  // До сих пор это можно было сделать только на экране "Мой путь" старого маршрута /,
  // который срез В упраздняет — без этого контрола женщина осталась бы без способа сменить
  // язык или заново включить напоминания. ВРЕМЕННО: полноценный выбор языка по ТЗ должен
  // жить в онбординге (раздел 6.2, шаг 3, вопрос о пути + согласия) — когда тот срез будет
  // сделан, этот блок стоит убрать или заменить.
  const [lang, setLang] = useState<Lang | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(false);

  useMainButton({
    text: 'Начать чек-ин',
    onClick: () => push('checkin'),
  });

  useEffect(() => {
    let cancelled = false;

    apiFetch<MeResponse>('/me')
      .then((me) => {
        if (cancelled) return;
        setAuthStatus({ state: 'ok', me });
        setLang(me.language === 'kk' ? 'kk' : 'ru');
        setReminderOptIn(me.reminderOptIn);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message =
          e instanceof ApiError ? `${e.status}: ${e.message}` : 'Сеть недоступна';
        setAuthStatus({ state: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLangChange = (next: Lang) => {
    setLang(next);
    apiFetch('/language', { method: 'POST', body: JSON.stringify({ language: next }) }).catch(
      () => {
        // Не блокируем UI сетевой ошибкой — значение переключится обратно при следующей
        // успешной загрузке /me, попытка не потеряна безвозвратно для пользователя.
      }
    );
  };

  const handleReminderToggle = (checked: boolean) => {
    setReminderOptIn(checked);
    apiFetch('/reminder-opt-in', { method: 'POST', body: JSON.stringify({ optIn: checked }) }).catch(
      () => {
        // аналогично — не блокируем UI
      }
    );
  };

  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Здравствуйте 🤍</h1>
      <p className="body-text">Нажмите «Начать чек-ин» внизу экрана — это займёт меньше минуты.</p>

      <p className="body-text" style={{ color: 'var(--hint)', fontSize: 13 }}>
        {authStatus.state === 'loading' && 'Проверяю связь с сервером…'}
        {authStatus.state === 'ok' &&
          `Сервер узнал вас (initData подтверждена): язык — ${authStatus.me.language ?? 'не выбран'}.`}
        {authStatus.state === 'error' && `Не удалось подтвердить initData: ${authStatus.message}`}
      </p>

      <button type="button" className="btn-secondary" onClick={() => push('progress')}>
        Мой путь
      </button>
      <button type="button" className="btn-secondary" onClick={() => push('techniques')}>
        Все техники самопомощи
      </button>

      {authStatus.state === 'ok' && lang && (
        <div className="settings-section">
          <p className="settings-label">Язык / Тіл</p>
          <div className="lang-toggle">
            <button
              type="button"
              className={lang === 'ru' ? 'active' : ''}
              onClick={() => handleLangChange('ru')}
            >
              RU
            </button>
            <button
              type="button"
              className={lang === 'kk' ? 'active' : ''}
              onClick={() => handleLangChange('kk')}
            >
              KK
            </button>
          </div>

          <label className="reminder-toggle-row">
            <input
              type="checkbox"
              checked={reminderOptIn}
              onChange={(e) => handleReminderToggle(e.target.checked)}
            />
            <span>Напоминание вечером</span>
          </label>
        </div>
      )}
    </main>
  );
}
