// AnketaNameScreen.tsx — анкета онбординга, Шаг 1 (ТЗ v2.13, 6.2.2). НЕ подключён к
// навигации (Срез О2, Промпт 2/4) — на вход получает lang/onLangChange/onNext снаружи,
// подключение в реальный флоу — Промпт 3/4.
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useMainButton } from '../../lib/useMainButton';
import { STEP1_NAME, ANKETA_COMMON, type Lang } from '../../content/anketa';

interface AnketaNameScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

export default function AnketaNameScreen({ lang, onLangChange, onNext }: AnketaNameScreenProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const t = STEP1_NAME[lang];
  const common = ANKETA_COMMON[lang];

  const handleNext = async () => {
    if (submitting) return;
    const trimmed = name.trim();

    // Шаг необязательный (ТЗ 6.2.2) — если ничего не введено, просто идём дальше без
    // сетевого вызова: полю и так ничего сохранять не нужно, оно уже null по умолчанию.
    if (trimmed) {
      setSubmitting(true);
      try {
        await apiFetch('/anketa/name', { method: 'POST', body: JSON.stringify({ displayName: trimmed }) });
      } catch {
        // Не блокируем прохождение анкеты сетевой ошибкой — тот же паттерн, что и в
        // остальном приложении (HomeScreen/WelcomeScreen).
      }
      setSubmitting(false);
    }
    onNext();
  };

  useMainButton({
    text: common.next,
    onClick: handleNext,
    isEnabled: !submitting,
    isLoaderVisible: submitting,
  });

  return (
    <main className="screen">
      <div className="lang-toggle">
        <button type="button" className={lang === 'ru' ? 'active' : ''} onClick={() => onLangChange('ru')}>
          RU
        </button>
        <button type="button" className={lang === 'kk' ? 'active' : ''} onClick={() => onLangChange('kk')}>
          KK
        </button>
      </div>

      <p className="eyebrow">SanaWell</p>
      <p className="anketa-question">{t.question}</p>
      <p className="anketa-hint">{t.hint}</p>

      <label className="comment-label" htmlFor="anketa-name">
        {t.placeholder}
      </label>
      <input
        id="anketa-name"
        className="comment-input"
        type="text"
        placeholder={t.placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
      />
    </main>
  );
}
