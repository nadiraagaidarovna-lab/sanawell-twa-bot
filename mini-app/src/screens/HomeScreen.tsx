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

export default function HomeScreen() {
  const { push } = useNavigation();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ state: 'loading' });

  useMainButton({
    text: 'Начать чек-ин',
    onClick: () => push('checkin'),
  });

  useEffect(() => {
    let cancelled = false;

    apiFetch<MeResponse>('/me')
      .then((me) => {
        if (!cancelled) setAuthStatus({ state: 'ok', me });
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

  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Как вы сегодня?</h1>
      <p className="body-text">Нажмите «Начать чек-ин» внизу экрана.</p>

      <p className="body-text" style={{ color: 'var(--hint)', fontSize: 13 }}>
        {authStatus.state === 'loading' && 'Проверяю связь с сервером…'}
        {authStatus.state === 'ok' &&
          `Сервер узнал вас (initData подтверждена): язык — ${authStatus.me.language ?? 'не выбран'}.`}
        {authStatus.state === 'error' && `Не удалось подтвердить initData: ${authStatus.message}`}
      </p>
    </main>
  );
}
