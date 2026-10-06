// ConsentScreen.tsx — экран согласий онбординга (Срез О5, ТЗ v2.13, раздел 13 + упоминание
// в разделе 6.2). Промпт 1/2: только сам экран, БЕЗ подключения к навигации — Промпт 2/2
// вставит его в реальный флоу сразу после Шага 0 (WelcomeScreen) и до анкеты (screens/anketa/).
// Контролируемый компонент по тому же паттерну, что и экраны анкеты (Срез О2, Промпт 2/4):
// lang/onLangChange/onNext приходят снаружи, экран сам не знает, куда ведёт "Продолжить".
//
// Бэкенд для согласий полностью сделан в Срезе О1 (раздел 13 ТЗ) и задеплоен — этот экран
// только переиспользует существующие поля/эндпоинты, ничего нового не создаёт. Названия полей
// в БД предшествуют финальной формулировке двух чекбоксов (решение Надиры от 15.09.2026,
// см. CLAUDE.md), поэтому мэппинг по смыслу, а не по имени:
//   Чекбокс 1 "обработка персональных данных и данных о здоровье" -> data_storage_consent_at
//     (POST /api/consent/data-storage, поле dataStorageConsented в GET /api/me)
//   Чекбокс 2 "принятие пользовательского соглашения и политики конфиденциальности"
//     -> medical_disclaimer_consent_at (POST /api/consent/medical-disclaimer,
//     поле medicalDisclaimerConsented в GET /api/me)
// Оба согласия обязательны (раздел 13 ТЗ) — кнопка "Продолжить" неактивна, пока не отмечены
// оба чекбокса.
import { useState } from 'react';
import { useMainButton } from '../lib/useMainButton';
import { legalDocumentTitle, legalDocumentUrl, type LegalDocumentKey } from '../lib/legalDocuments';
import { saveConsents } from '../lib/onboardingFocusGroup';

export type Lang = 'ru' | 'kk';

// Document links come from the single source lib/legal-documents.json (same as the new
// onboarding and the cabinet). Titles stay in Russian: the documents exist only in Russian.
const DOCUMENT_LINKS: LegalDocumentKey[] = ['terms', 'privacy', 'dataConsent'];

const TEXT: Record<
  Lang,
  {
    title: string;
    hint: string;
    dataConsentLabel: string;
    policyConsentBefore: string;
    policyConsentLink: string;
    policyConsentAfter: string;
    button: string;
    error: string;
  }
> = {
  ru: {
    title: 'Прежде чем продолжить',
    hint: 'Оба пункта ниже обязательны — без них, к сожалению, нельзя пользоваться SanaWell AI.',
    dataConsentLabel: 'Согласие на обработку персональных данных и данных о здоровье',
    policyConsentBefore: 'Принятие ',
    policyConsentLink: 'пользовательского соглашения и политики конфиденциальности',
    policyConsentAfter: '',
    button: 'Продолжить',
    error: 'Не удалось сохранить согласие. Проверьте интернет и попробуйте ещё раз.',
  },
  kk: {
    title: 'Жалғастырмас бұрын',
    hint: 'Төмендегі екі тармақ та міндетті — оларсыз, өкінішке орай, SanaWell AI қолдануға болмайды.',
    dataConsentLabel: 'Жеке деректерді және денсаулық туралы деректерді өңдеуге келісім',
    policyConsentBefore: '',
    policyConsentLink: 'Пайдаланушы келісімі мен құпиялылық саясатын',
    policyConsentAfter: ' қабылдау',
    button: 'Жалғастыру',
    // Черновой перевод, требует проверки носителем языка.
    error: 'Келісімді сақтау мүмкін болмады. Интернетті тексеріп, қайталап көріңіз.',
  },
};

interface ConsentScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

export default function ConsentScreen({ lang, onLangChange, onNext }: ConsentScreenProps) {
  const [dataConsent, setDataConsent] = useState(false);
  const [policyConsent, setPolicyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const t = TEXT[lang];
  const bothChecked = dataConsent && policyConsent;

  const handleContinue = async () => {
    if (submitting || !bothChecked) return;
    setSubmitting(true);
    setSaveError(false);
    try {
      // Versioned, server-confirmed record. Without it the server rejects all further writes,
      // so a failed save must stop here and be visible instead of silently moving on.
      await saveConsents('legacy_consent_screen');
    } catch {
      setSaveError(true);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onNext();
  };

  useMainButton({
    text: t.button,
    onClick: handleContinue,
    isEnabled: bothChecked && !submitting,
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
      <p className="anketa-question">{t.title}</p>
      <p className="anketa-hint">{t.hint}</p>

      <label className="anketa-checkbox-row">
        <input type="checkbox" checked={dataConsent} onChange={() => setDataConsent((v) => !v)} />
        <span>{t.dataConsentLabel}</span>
      </label>

      <label className="anketa-checkbox-row">
        <input type="checkbox" checked={policyConsent} onChange={() => setPolicyConsent((v) => !v)} />
        <span>
          {t.policyConsentBefore}
          <a
            href={legalDocumentUrl('terms')}
            target="_blank"
            rel="noopener noreferrer"
            className="consent-policy-link"
            // Ссылка лежит внутри <label> (чтобы клик по остальному тексту тоже переключал
            // чекбокс) — без stopPropagation клик по самой ссылке ДОПОЛНИТЕЛЬНО переключил
            // бы чекбокс (стандартное поведение вложенного интерактивного элемента внутри
            // <label>), а должен только открыть документ.
            onClick={(e) => e.stopPropagation()}
          >
            {t.policyConsentLink}
          </a>
          {t.policyConsentAfter}
        </span>
      </label>

      {DOCUMENT_LINKS.map((key) => (
        <a key={key} className="consent-policy-link" style={{ display: 'block', marginTop: 12 }}
          href={legalDocumentUrl(key)} target="_blank" rel="noopener noreferrer">
          {legalDocumentTitle(key)}
        </a>
      ))}

      {saveError && <p role="alert" className="anketa-hint" style={{ marginTop: 16 }}>{t.error}</p>}
    </main>
  );
}
