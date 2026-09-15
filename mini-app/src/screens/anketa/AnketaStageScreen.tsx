// AnketaStageScreen.tsx — анкета онбординга, Шаг 3, самоощущаемый этап (ТЗ v2.13, 6.2.2:
// субъективная самооценка, не диагностический вывод приложения — раздел 9.2). НЕ подключён
// к навигации (Срез О2, Промпт 2/4) — см. AnketaNameScreen.tsx для общего паттерна.
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useMainButton } from '../../lib/useMainButton';
import AnketaOptionList from '../../components/AnketaOptionList';
import { STEP3_STAGE, ANKETA_COMMON, type Lang } from '../../content/anketa';

interface AnketaStageScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

export default function AnketaStageScreen({ lang, onLangChange, onNext }: AnketaStageScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const t = STEP3_STAGE[lang];
  const common = ANKETA_COMMON[lang];

  const handleNext = async () => {
    if (submitting) return;
    if (selected) {
      setSubmitting(true);
      try {
        await apiFetch('/anketa/self-perceived-stage', {
          method: 'POST',
          body: JSON.stringify({ stage: selected }),
        });
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
