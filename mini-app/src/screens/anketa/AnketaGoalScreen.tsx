// AnketaGoalScreen.tsx — анкета онбординга, Шаг 5, главная цель (ТЗ v2.13, 6.2.2).
// goal хранится как свободный текст (не enum, см. Промпт 1/4) — предустановленные варианты
// отправляются как есть (в текущем языке экрана), "Своё" раскрывает поле ввода и
// отправляется то, что пользователь написал сам. НЕ подключён к навигации (Промпт 2/4).
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useMainButton } from '../../lib/useMainButton';
import AnketaOptionList from '../../components/AnketaOptionList';
import { STEP5_GOAL, ANKETA_COMMON, type Lang } from '../../content/anketa';

interface AnketaGoalScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

export default function AnketaGoalScreen({ lang, onLangChange, onNext }: AnketaGoalScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const t = STEP5_GOAL[lang];
  const common = ANKETA_COMMON[lang];
  const isCustom = selected === 'custom';

  const handleNext = async () => {
    if (submitting) return;

    let goalText: string | null = null;
    if (isCustom) {
      goalText = customText.trim() || null;
    } else if (selected) {
      goalText = t.options.find((o) => o.value === selected)?.label ?? null;
    }

    // Ключ предустановленного варианта ('sleep', 'nutrition_weight', ...) — не зависит от языка
    // экрана (в отличие от goalText). Для «Своё» и «ничего не выбрано» — null. По ключу бэкенд
    // подбирает приоритетную технику в еженедельном отчёте (users.goal_key).
    const goalKeyValue = selected && selected !== 'custom' ? selected : null;

    if (goalText) {
      setSubmitting(true);
      try {
        await apiFetch('/anketa/goal', {
          method: 'POST',
          body: JSON.stringify({ goal: goalText, goalKey: goalKeyValue }),
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

      {isCustom && (
        <input
          className="comment-input"
          type="text"
          placeholder={t.customPlaceholder}
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          maxLength={200}
          style={{ marginTop: 4 }}
        />
      )}
    </main>
  );
}
