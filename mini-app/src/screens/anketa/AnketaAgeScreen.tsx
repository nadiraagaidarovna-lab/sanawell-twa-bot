// AnketaAgeScreen.tsx — анкета онбординга, Шаг 2 (ТЗ v2.13, 6.2.2). НЕ подключён к
// навигации (Срез О2, Промпт 2/4) — см. AnketaNameScreen.tsx для общего паттерна.
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useMainButton } from '../../lib/useMainButton';
import AnketaOptionList from '../../components/AnketaOptionList';
import { STEP2_AGE, ANKETA_COMMON, type Lang } from '../../content/anketa';

interface AnketaAgeScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

export default function AnketaAgeScreen({ lang, onLangChange, onNext }: AnketaAgeScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const t = STEP2_AGE[lang];
  const common = ANKETA_COMMON[lang];

  const handleNext = async () => {
    if (submitting) return;
    if (selected) {
      setSubmitting(true);
      try {
        await apiFetch('/anketa/age-range', { method: 'POST', body: JSON.stringify({ ageRange: selected }) });
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

      <AnketaOptionList options={t.options} selected={selected} onSelect={setSelected} />
    </main>
  );
}
