// CabinetScreen.tsx — «Личный кабинет» (Срез Д, Промпт 1/5 — перенос блока настроек из
// HomeScreen.tsx 1:1; Промпт 5/5, часть 2 — укороченная MVP-версия по docs/personal-cabinet-v1.md).
// Блоки сверху вниз: профиль, «Мой прогресс», тариф, напоминания, настройки и документы,
// удаление аккаунта. Сознательно НЕ входит в MVP (см. тот же документ): «Выйти из аккаунта»
// (в Mini App доступ определяется initData при каждом открытии — выходить не из чего),
// доверенное лицо, экспорт данных, время напоминаний, тема оформления, история платежей,
// фото профиля. Тариф — хардкод Basic: колонки тарифа в БД нет, цены и оплата не утверждены
// (раздел 17 ТЗ), поэтому ни цен, ни платёжного провайдера здесь нет.
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useNavigation } from '../lib/useNavigation';
import { formatDate, pluralDays } from '../lib/progressFormat';
import BottomNav from '../components/BottomNav';
import { POLICY_PLACEHOLDER_URL } from './ConsentScreen';

interface MeResponse {
  onboarded: boolean;
  language: string | null;
  reminderOptIn: boolean;
  habitsReminderOptIn: boolean;
  displayName: string | null;
  age: number | null;
  email: string | null;
  phone: string | null;
  accountDeleted: boolean;
}

interface SummaryResponse {
  daysCount: number;
  lastCheckinDate: string | null;
}

type AuthStatus =
  | { state: 'loading' }
  | { state: 'ok'; me: MeResponse }
  | { state: 'error'; message: string };

type Lang = 'ru' | 'kk';

// 'confirm' — первый шаг («Удалить аккаунт?»), 'sending' — запрос ушёл, 'done' — принят.
type DeleteStep = 'idle' | 'confirm' | 'sending' | 'done';

export default function CabinetScreen() {
  const { push } = useNavigation();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ state: 'loading' });
  const [lang, setLang] = useState<Lang | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(false);
  const [habitsReminderOptIn, setHabitsReminderOptIn] = useState(false);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Отмена запроса на удаление (кнопка в состоянии 'done') — отдельный флаг, чтобы не менять
  // deleteStep, пока запрос в пути, и не дать нажать дважды.
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch<MeResponse>('/me')
      .then((me) => {
        if (cancelled) return;
        setAuthStatus({ state: 'ok', me });
        setLang(me.language === 'kk' ? 'kk' : 'ru');
        setReminderOptIn(me.reminderOptIn);
        setHabitsReminderOptIn(me.habitsReminderOptIn);
        if (me.accountDeleted) setDeleteStep('done');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message =
          e instanceof ApiError ? `${e.status}: ${e.message}` : 'Сеть недоступна';
        setAuthStatus({ state: 'error', message });
      });

    // Блок «Мой прогресс» — необязательный: при ошибке просто не показываем его.
    apiFetch<SummaryResponse>('/checkin/summary')
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {});

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

  const handleConfirmDelete = async () => {
    setDeleteStep('sending');
    setDeleteError(null);
    try {
      await apiFetch('/account/delete-request', { method: 'POST' });
      // Бэкенд заодно отключил оба напоминания — синхронизируем переключатели на экране.
      setReminderOptIn(false);
      setHabitsReminderOptIn(false);
      setDeleteStep('done');
    } catch {
      // Успех не имитируем: если запрос не дошёл, женщина должна это знать.
      setDeleteError('Не удалось отправить запрос. Попробуйте ещё раз чуть позже.');
      setDeleteStep('confirm');
    }
  };

  const handleCancelDeletion = async () => {
    if (cancelling) return;
    setCancelling(true);
    setDeleteError(null);
    try {
      await apiFetch('/account/cancel-deletion', { method: 'POST' });
      // Блок удаления возвращается в исходное состояние, локальный me — тоже, чтобы не
      // перезагружать экран. Напоминания остаются выключенными (бэкенд их не включает):
      // переключатели уже показывают false после запроса на удаление и не меняются.
      setAuthStatus((prev) =>
        prev.state === 'ok' ? { state: 'ok', me: { ...prev.me, accountDeleted: false } } : prev
      );
      setDeleteStep('idle');
    } catch {
      // Успех не имитируем: если отмена не дошла, женщина должна это знать; шаг не меняем —
      // запрос на удаление по-прежнему принят.
      setDeleteError('Не удалось отменить запрос. Попробуйте ещё раз чуть позже.');
    }
    setCancelling(false);
  };

  const me = authStatus.state === 'ok' ? authStatus.me : null;

  return (
    <main className="screen v2-screen v2-accent-cabinet">
      <p className="eyebrow">SanaWell</p>
      <h1>Личный кабинет</h1>

      {authStatus.state === 'loading' && (
        <p className="body-text" style={{ color: 'var(--v2-ink-soft)', fontSize: 13 }}>
          Проверяю связь с сервером…
        </p>
      )}
      {authStatus.state === 'error' && (
        <p className="body-text" style={{ color: 'var(--v2-ink-soft)', fontSize: 13 }}>
          Не удалось подтвердить initData: {authStatus.message}
        </p>
      )}

      {me && lang && (
        <>
          {/* 1. Профиль */}
          <section className="cabinet-card">
            <p className="cabinet-heading">Профиль</p>
            {me.displayName ? (
              <>
                <p className="cabinet-name">{me.displayName}</p>
                {me.age != null && <p className="cabinet-line">Возраст: {me.age}</p>}
                {me.email && <p className="cabinet-line">{me.email}</p>}
                {me.phone && <p className="cabinet-line">{me.phone}</p>}
                <button type="button" className="cabinet-btn" onClick={() => push('profile-edit')}>
                  Редактировать профиль
                </button>
              </>
            ) : (
              <>
                <p className="cabinet-line">Добавьте имя, чтобы персонализировать рекомендации</p>
                <button type="button" className="cabinet-btn" onClick={() => push('profile-edit')}>
                  Заполнить профиль
                </button>
              </>
            )}
          </section>

          {/* 2. Мой прогресс */}
          <section className="cabinet-card">
            <p className="cabinet-heading">Мой прогресс</p>
            {summary && summary.daysCount > 0 ? (
              <>
                <p className="cabinet-line">
                  Вы ведёте наблюдения {summary.daysCount} {pluralDays(summary.daysCount)}
                </p>
                {summary.lastCheckinDate && (
                  <p className="cabinet-line">Последняя запись — {formatDate(summary.lastCheckinDate)}</p>
                )}
              </>
            ) : (
              <p className="cabinet-line">Записей пока нет — они появятся после первого чек-ина.</p>
            )}
            <p className="cabinet-note">
              Регулярные записи помогают замечать изменения и обсуждать их с врачом.
            </p>
            <button type="button" className="cabinet-btn" onClick={() => push('progress')}>
              Посмотреть прогресс
            </button>
          </section>

          {/* 3. Тариф */}
          <section className="cabinet-card">
            <p className="cabinet-heading">Тариф</p>
            <p className="cabinet-line">Ваш тариф: Basic</p>
            <button type="button" className="cabinet-btn" onClick={() => push('tariff')}>
              Изменить тариф
            </button>
          </section>

          {/* 4. Напоминания — те же два переключателя, что и раньше, только подписи мягче. */}
          <section className="cabinet-card">
            <p className="cabinet-heading">Напоминания</p>
            <label className="reminder-toggle-row">
              <input
                type="checkbox"
                checked={reminderOptIn}
                onChange={(e) => handleReminderToggle(e.target.checked)}
              />
              <span>Напоминать вечером отметить самочувствие</span>
            </label>
            <label className="reminder-toggle-row">
              <input
                type="checkbox"
                checked={habitsReminderOptIn}
                onChange={(e) => handleHabitsReminderToggle(e.target.checked)}
              />
              <span>Напоминать про питание и силовые упражнения</span>
            </label>
          </section>

          {/* 5. Настройки и документы */}
          <section className="cabinet-card">
            <p className="cabinet-heading">Язык / Тіл</p>
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

            <p className="cabinet-heading" style={{ marginTop: 16 }}>
              Документы
            </p>
            {/* Та же ссылка-плейсхолдер, что на экране согласий (ЗАМЕНИТЬ перед публичным
                запуском — см. ConsentScreen.tsx и CLAUDE.md). */}
            <a
              className="cabinet-link"
              href={POLICY_PLACEHOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Политика конфиденциальности
            </a>
            <a
              className="cabinet-link"
              href={POLICY_PLACEHOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Пользовательское соглашение
            </a>

            {/* Срез О3 (ТЗ 6.2.1): ручной повторный показ Шага 0 — не трогает
                onboarding_welcome_seen на бэкенде, только навигация. */}
            <p className="cabinet-heading" style={{ marginTop: 16 }}>
              О приложении
            </p>
            <button type="button" className="cabinet-btn" onClick={() => push('welcome')}>
              Показать приветствие снова
            </button>
          </section>

          {/* 6. Удаление аккаунта */}
          <section className="cabinet-card cabinet-danger-zone">
            {deleteStep === 'idle' && (
              <button type="button" className="cabinet-btn-danger" onClick={() => setDeleteStep('confirm')}>
                Удалить аккаунт
              </button>
            )}

            {(deleteStep === 'confirm' || deleteStep === 'sending') && (
              <>
                <p className="cabinet-name">Удалить аккаунт?</p>
                <p className="cabinet-note">Удаление аккаунта необратимо после обработки запроса.</p>
                {deleteError && <p className="cabinet-error">{deleteError}</p>}
                <div className="cabinet-confirm-row">
                  <button
                    type="button"
                    className="cabinet-btn"
                    disabled={deleteStep === 'sending'}
                    onClick={() => {
                      setDeleteStep('idle');
                      setDeleteError(null);
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="cabinet-btn-danger"
                    disabled={deleteStep === 'sending'}
                    onClick={handleConfirmDelete}
                  >
                    {deleteStep === 'sending' ? 'Отправляю…' : 'Удалить'}
                  </button>
                </div>
              </>
            )}

            {deleteStep === 'done' && (
              <>
                <p className="cabinet-name">Запрос на удаление принят</p>
                <p className="cabinet-note">
                  Мы отключили напоминания и обработаем запрос. Спасибо, что были с SanaWell.
                </p>
                {deleteError && <p className="cabinet-error">{deleteError}</p>}
                <button
                  type="button"
                  className="cabinet-btn"
                  disabled={cancelling}
                  onClick={handleCancelDeletion}
                >
                  {cancelling ? 'Отменяю…' : 'Отменить запрос'}
                </button>
                <button type="button" className="cabinet-btn" onClick={() => push('home')}>
                  На главный экран
                </button>
              </>
            )}
          </section>
        </>
      )}

      <BottomNav active="cabinet" />
    </main>
  );
}
