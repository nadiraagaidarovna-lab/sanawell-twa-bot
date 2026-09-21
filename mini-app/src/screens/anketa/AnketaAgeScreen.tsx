// AnketaAgeScreen.tsx — анкета онбординга, Шаг 2 (ТЗ v2.13, 6.2.2). Контролируемый компонент
// по тому же паттерну, что AnketaNameScreen.tsx (lang/onLangChange/onNext приходят снаружи).
// Возраст — свободное числовое поле 18–100 (users.age), а не категории: сохраняется через
// POST /api/anketa/age, который точечно пишет только age. НЕ через POST /api/profile — тот
// перезаписывает display_name/email/phone разом и обнулил бы имя, введённое на Шаге 1.
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useMainButton } from '../../lib/useMainButton';
import { STEP2_AGE, ANKETA_COMMON, type Lang } from '../../content/anketa';

const AGE_MIN = 18;
const AGE_MAX = 100;

interface AnketaAgeScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

export default function AnketaAgeScreen({ lang, onLangChange, onNext }: AnketaAgeScreenProps) {
  const [age, setAge] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const t = STEP2_AGE[lang];
  const common = ANKETA_COMMON[lang];

  const ageNumber = Number(age);
  // Пустое поле — не ошибка (шаг необязательный, ТЗ 6.2.2), ошибка — только непустое значение
  // вне диапазона.
  const invalid = age !== '' && (!Number.isInteger(ageNumber) || ageNumber < AGE_MIN || ageNumber > AGE_MAX);
  // Не ругаемся на первую же цифру («4» по пути к «47») — только после 2+ цифр или ухода с поля.
  const showError = invalid && (touched || age.length >= 2);

  const handleNext = async () => {
    if (submitting || invalid) return;

    // Шаг необязательный — пустое поле идёт дальше без сетевого вызова, как Шаг 1.
    if (age !== '') {
      setSubmitting(true);
      try {
        await apiFetch('/anketa/age', { method: 'POST', body: JSON.stringify({ age: ageNumber }) });
      } catch {
        // Не блокируем прохождение анкеты сетевой ошибкой.
      }
      setSubmitting(false);
    }
    onNext();
  };

  useMainButton({
    text: common.next,
    onClick: handleNext,
    isEnabled: !submitting && !invalid,
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

      <label className="comment-label" htmlFor="anketa-age">
        {t.placeholder}
      </label>
      <input
        id="anketa-age"
        className="comment-input"
        type="text"
        inputMode="numeric"
        placeholder={t.placeholder}
        value={age}
        // Только цифры, до 3 знаков (макс. 100) — свободный числовой ввод без спиннеров type="number".
        onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={() => setTouched(true)}
        aria-invalid={showError}
      />

      {showError && (
        <p className="anketa-hint" style={{ color: 'var(--sw-terracotta)', margin: '10px 0 0' }}>
          {t.error}
        </p>
      )}
    </main>
  );
}
