// CabinetScreen.tsx — «Личный кабинет» (Срез Д, Промпт 1/5, ТЗ 4.4.1, нижняя навигация).
// Временный, рабочий вариант: сюда 1:1 перенесён существующий блок настроек из
// HomeScreen.tsx (язык, оба переключателя напоминаний, повторный показ Шага 0) — логика
// не переписана, только перенесена в отдельный экран со своим GET /api/me (тот же паттерн,
// что раньше был в HomeScreen.tsx). Окончательный объём "Личного кабинета" ещё не решён
// Надирой (ТЗ 4.4.1) — отдельная будущая задача, сейчас важно не потерять функционал.
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useNavigation } from '../lib/useNavigation';
import BottomNav from '../components/BottomNav';

interface MeResponse {
  onboarded: boolean;
  language: string | null;
  reminderOptIn: boolean;
  habitsReminderOptIn: boolean;
}

type AuthStatus =
  | { state: 'loading' }
  | { state: 'ok'; me: MeResponse }
  | { state: 'error'; message: string };

type Lang = 'ru' | 'kk';

export default function CabinetScreen() {
  const { push } = useNavigation();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ state: 'loading' });
  const [lang, setLang] = useState<Lang | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(false);
  const [habitsReminderOptIn, setHabitsReminderOptIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch<MeResponse>('/me')
      .then((me) => {
        if (cancelled) return;
        setAuthStatus({ state: 'ok', me });
        setLang(me.language === 'kk' ? 'kk' : 'ru');
        setReminderOptIn(me.reminderOptIn);
        setHabitsReminderOptIn(me.habitsReminderOptIn);
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

  const handleHabitsReminderToggle = (checked: boolean) => {
    setHabitsReminderOptIn(checked);
    apiFetch('/habits-reminder-opt-in', {
      method: 'POST',
      body: JSON.stringify({ optIn: checked }),
    }).catch(() => {
      // аналогично — не блокируем UI
    });
  };

  return (
    <main className="screen v2-screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Личный кабинет</h1>

      {authStatus.state === 'loading' && (
        <p className="body-text" style={{ color: 'var(--hint)', fontSize: 13 }}>
          Проверяю связь с сервером…
        </p>
      )}
      {authStatus.state === 'error' && (
        <p className="body-text" style={{ color: 'var(--hint)', fontSize: 13 }}>
          Не удалось подтвердить initData: {authStatus.message}
        </p>
      )}

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

          <label className="reminder-toggle-row">
            <input
              type="checkbox"
              checked={habitsReminderOptIn}
              onChange={(e) => handleHabitsReminderToggle(e.target.checked)}
            />
            <span>Напоминание про питание и силовые</span>
          </label>

          {/* Срез О3 (ТЗ 6.2.1): ручной повторный показ Шага 0 — не трогает
              onboarding_welcome_seen на бэкенде, только навигация. */}
          <p className="settings-label" style={{ marginTop: 20 }}>
            О приложении
          </p>
          <button type="button" className="btn-secondary" onClick={() => push('welcome')}>
            Показать приветствие снова
          </button>
        </div>
      )}

      <BottomNav active="cabinet" />
    </main>
  );
}
