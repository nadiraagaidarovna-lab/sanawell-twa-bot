// AnketaPathScreen.tsx — анкета онбординга, Шаг 4, путь менопаузы (ТЗ v2.13, 6.2.2).
// Переиспользует POST /api/menopause-path из Среза О1 (отдельного /anketa/*-эндпоинта
// под этот шаг нет — см. Промпт 1/4). Тизер "Этапы жизни после 40" показывается сразу
// после выбора варианта — просто карточка-анонс, полная тема 5.3.1 ещё не построена
// (Срез О4), поэтому текст тизера один и тот же для всех путей на этом этапе, не
// вариативный по пути, как в итоговой версии ТЗ — сознательное упрощение объёма Промпта 2.
// НЕ подключён к навигации (Промпт 2/4) — см. AnketaNameScreen.tsx для общего паттерна.
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useMainButton } from '../../lib/useMainButton';
import AnketaOptionList from '../../components/AnketaOptionList';
import { STEP4_PATH, STEP4_TEASER, ANKETA_COMMON, type Lang } from '../../content/anketa';

interface AnketaPathScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

// "Затрудняюсь ответить" в UI -> на бэкенд уходит как 'natural' (техническое решение по
// умолчанию из ТЗ v2.13, раздел 6.2.2 — наименее интенсивный образовательный трек).
function toBackendPath(uiValue: string): string {
  return uiValue === 'unsure' ? 'natural' : uiValue;
}

export default function AnketaPathScreen({ lang, onLangChange, onNext }: AnketaPathScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const t = STEP4_PATH[lang];
  const teaser = STEP4_TEASER[lang];
  const common = ANKETA_COMMON[lang];

  const handleNext = async () => {
    if (submitting) return;
    if (selected) {
      setSubmitting(true);
      try {
        await apiFetch('/menopause-path', {
          method: 'POST',
          body: JSON.stringify({ path: toBackendPath(selected) }),
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

      {selected && (
        <div className="anketa-teaser">
          <p className="anketa-teaser-title">{teaser.title}</p>
          <p className="anketa-teaser-body">{teaser.body}</p>
        </div>
      )}
    </main>
  );
}
