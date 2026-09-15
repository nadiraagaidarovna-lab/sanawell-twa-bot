// AnketaLifestyleScreen.tsx — анкета онбординга, Шаг 6, образ жизни (ТЗ v2.13, 6.2.2):
// единственный полностью необязательный блок с отдельной кнопкой "Пропустить" на весь
// шаг целиком, а не по кнопке "Далее" молча — остальные шаги обходятся одним "Далее"
// (нажатие без выбора = пропуск), этот шаг явно выделен в ТЗ как особый случай из-за
// трёх подвопросов сразу. Стресс — тот же ScaleSlider, что в ежедневном чек-ине (ТЗ
// 5.1/6.3), просто с другими подписями по краям вместо одного .scale-hint снизу.
// НЕ подключён к навигации (Срез О2, Промпт 2/4).
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useMainButton } from '../../lib/useMainButton';
import AnketaOptionList from '../../components/AnketaOptionList';
import ScaleSlider from '../../components/ScaleSlider';
import { STEP6_LIFESTYLE, ANKETA_COMMON, type Lang } from '../../content/anketa';

interface AnketaLifestyleScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

const NO_STRESS_ANSWER = 0; // "не отвечено" — не входит в диапазон 1-10, не отправляется

export default function AnketaLifestyleScreen({ lang, onLangChange, onNext }: AnketaLifestyleScreenProps) {
  const [activity, setActivity] = useState<string | null>(null);
  const [diet, setDiet] = useState<string | null>(null);
  const [stress, setStress] = useState(NO_STRESS_ANSWER);
  const [submitting, setSubmitting] = useState(false);

  const t = STEP6_LIFESTYLE[lang];
  const common = ANKETA_COMMON[lang];

  const hasAnyAnswer = !!activity || !!diet || stress !== NO_STRESS_ANSWER;

  const submitAndProceed = async () => {
    if (submitting) return;
    if (hasAnyAnswer) {
      setSubmitting(true);
      try {
        await apiFetch('/anketa/lifestyle', {
          method: 'POST',
          body: JSON.stringify({
            activity,
            diet,
            stressLevel: stress === NO_STRESS_ANSWER ? null : stress,
          }),
        });
      } catch {
        // Не блокируем прохождение анкеты сетевой ошибкой.
      }
      setSubmitting(false);
    }
    onNext();
  };

  // Явный "Пропустить" из ТЗ — весь шаг целиком, без сохранения даже частично введённого
  // (если передумали отвечать — жмут именно эту кнопку, не "Далее").
  const handleSkip = () => {
    if (submitting) return;
    onNext();
  };

  useMainButton({
    text: common.next,
    onClick: submitAndProceed,
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
      <p className="anketa-hint" style={{ marginBottom: 20 }}>
        {t.title}
      </p>

      <div className="anketa-lifestyle-block">
        <p className="anketa-lifestyle-question">{t.activityQuestion}</p>
        <AnketaOptionList options={t.activityOptions} selected={activity} onSelect={setActivity} />
      </div>

      <div className="anketa-lifestyle-block">
        <p className="anketa-lifestyle-question">{t.dietQuestion}</p>
        <AnketaOptionList options={t.dietOptions} selected={diet} onSelect={setDiet} />
      </div>

      <div className="anketa-lifestyle-block">
        <p className="anketa-lifestyle-question">{t.stressQuestion}</p>
        <ScaleSlider
          label=""
          hint={`1 — ${t.stressLowLabel} · 10 — ${t.stressHighLabel}`}
          value={stress === NO_STRESS_ANSWER ? 5 : stress}
          onChange={setStress}
        />
      </div>

      <button type="button" className="btn-secondary" onClick={handleSkip}>
        {t.skipButton}
      </button>
    </main>
  );
}
