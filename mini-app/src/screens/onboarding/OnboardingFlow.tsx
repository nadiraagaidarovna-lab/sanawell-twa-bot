import { useEffect, useRef, useState } from 'react';
import logo from '../../assets/sanawell-logo.png';
import { getTelegramFirstName } from '../../lib/telegram';
import { useBackButton } from '../../lib/useBackButton';
import { useMainButton } from '../../lib/useMainButton';
import { apiFetch } from '../../lib/api';
import './OnboardingFlow.css';

// Self-descriptions only. Never translate these keys into a medical stage or path.
const CYCLE_OPTIONS = [
  ['regular', 'Мой цикл пока регулярный', 'Но я уже замечаю изменения в самочувствии.'],
  ['changing', 'Мой цикл стал меняться', 'Менструации приходят иначе, чем раньше.'],
  ['no_period_12m', 'Менструаций нет уже 12 месяцев или дольше', ''],
  ['post_surgery', 'Менструаций нет после операции', ''],
  ['treatment_affected', 'На цикл повлияло лечение или препараты', ''],
  ['other', 'У меня другая ситуация', ''],
  ['unsure', 'Я не знаю / не уверена', ''],
] as const;

const HRT_OPTIONS = [
  ['current', 'Да, принимаю сейчас', ''],
  ['no', 'Нет', ''],
  ['considering', 'Обсуждаю с врачом / планирую', ''],
  ['previous', 'Принимала раньше', ''],
  ['prefer_not_to_say', 'Не хочу отвечать', ''],
] as const;

const TITLES = [
  'Добро пожаловать в SanaWell AI',
  'Ваши данные — под вашим контролем',
  'Немного о вас',
  'Расскажите немного о вашем цикле',
  'Принимаете ли вы сейчас МГТ/ГЗТ?',
  'Начнём вашу историю 360°',
];

function Options({ name, options, value, onChange, disabled }: {
  name: string;
  options: readonly (readonly [string, string, string])[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return <fieldset className="sw-onboarding-options" aria-labelledby="onboarding-title" disabled={disabled}>
    {options.map(([key, label, hint]) => <label className="sw-onboarding-option" key={key}>
      <input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} />
      <span>{label}{hint && <span className="sw-onboarding-option-hint">{hint}</span>}</span>
    </label>)}
  </fieldset>;
}

/** Authenticated per-step persistence; production routing remains separate. */
export default function OnboardingFlow({ onCheckin }: { onCheckin: () => void | Promise<void> }) {
  const [step, setStep] = useState(0);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [name, setName] = useState(() => getTelegramFirstName() ?? '');
  const [age, setAge] = useState('');
  const [ageTouched, setAgeTouched] = useState(false);
  const [cycle, setCycle] = useState('');
  const [hrt, setHrt] = useState('');
  const [answersStatus, setAnswersStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const answerInFlight = useRef(false);
  const savedAnswers = useRef({ cycleSituation: '', mhtStatus: '' });
  const [finishing, setFinishing] = useState(false);
  const [completionError, setCompletionError] = useState('');
  const completionInFlight = useRef(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentError, setConsentError] = useState('');
  const consentInFlight = useRef(false);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const profileInFlight = useRef(false);
  const savedProfile = useRef<{ displayName: string | null; age: number | null }>({ displayName: null, age: null });
  const profileBusy = step === 2 && (profileStatus === 'loading' || savingProfile);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step !== 2 || profileStatus !== 'loading') return;
    let cancelled = false;
    apiFetch<{ displayName: string | null; age: number | null }>('/me')
      .then((me) => {
        if (cancelled) return;
        if ((me.displayName !== null && typeof me.displayName !== 'string') ||
          (me.age !== null && (!Number.isInteger(me.age) || me.age < 18 || me.age > 100))) {
          throw new Error('Profile unavailable');
        }
        savedProfile.current = { displayName: me.displayName, age: me.age };
        setName((current) => me.displayName ?? current);
        setAge(me.age === null ? '' : String(me.age));
        setProfileError('');
        setProfileStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setProfileStatus('error');
      });
    return () => { cancelled = true; };
  }, [step, profileStatus]);
  useEffect(() => {
    if ((step !== 3 && step !== 4) || answersStatus !== 'loading') return;
    let cancelled = false;
    apiFetch<{ cycleSituation: string | null; mhtStatus: string | null }>('/me')
      .then((me) => {
        if (cancelled) return;
        if ((me.cycleSituation !== null && !CYCLE_OPTIONS.some(([key]) => key === me.cycleSituation)) ||
          (me.mhtStatus !== null && !HRT_OPTIONS.some(([key]) => key === me.mhtStatus))) {
          throw new Error('Answers unavailable');
        }
        savedAnswers.current = { cycleSituation: me.cycleSituation ?? '', mhtStatus: me.mhtStatus ?? '' };
        setCycle(savedAnswers.current.cycleSituation);
        setHrt(savedAnswers.current.mhtStatus);
        setAnswersStatus('ready');
      })
      .catch(() => { if (!cancelled) setAnswersStatus('error'); });
    return () => { cancelled = true; };
  }, [step, answersStatus]);
  // Match the existing age endpoint; no 40+ restriction and no age categories.
  const invalidAge = age !== '' && (!/^\d+$/.test(age) || Number(age) < 18 || Number(age) > 100);
  const enabled = step === 1 ? terms && privacy : step === 2 ? !invalidAge && profileStatus === 'ready' && !savingProfile : step === 3 || step === 4 ? answersStatus === 'ready' && !savingAnswer && !!(step === 3 ? cycle : hrt) : true;
  const back = () => { setAnswerError(''); setStep((value) => Math.max(0, value - 1)); };
  const next = async () => {
    if (!enabled || consentInFlight.current || profileInFlight.current || answerInFlight.current || completionInFlight.current) return;
    if (step === 1) {
      consentInFlight.current = true;
      setSavingConsent(true);
      setConsentError('');
      try {
        // Read on every attempt: preserve existing timestamps and recover partial
        // saves, including a successful write whose response was lost in transit.
        const me = await apiFetch<{ medicalDisclaimerConsented: boolean; dataStorageConsented: boolean }>('/me');
        if (typeof me.medicalDisclaimerConsented !== 'boolean' || typeof me.dataStorageConsented !== 'boolean') {
          throw new Error('Consent status unavailable');
        }
        // Legacy UI already maps terms acceptance to this legacy-named endpoint.
        // No renaming or reinterpretation of historical records.
        for (const [stored, path] of [
          [me.medicalDisclaimerConsented, '/consent/medical-disclaimer'],
          [me.dataStorageConsented, '/consent/data-storage'],
        ] as const) {
          if (!stored) {
            const result = await apiFetch<{ ok: boolean }>(path, {
              method: 'POST', body: JSON.stringify({ consented: true }),
            });
            if (result.ok !== true) throw new Error('Consent save not confirmed');
          }
        }
        setStep(2);
      } catch {
        setConsentError('Не удалось подтвердить сохранение согласий. Попробуйте ещё раз.');
      } finally {
        consentInFlight.current = false;
        setSavingConsent(false);
      }
      return;
    }
    if (step === 2) {
      profileInFlight.current = true;
      setSavingProfile(true);
      setProfileError('');
      try {
        const trimmed = name.trim();
        // Blank optional inputs preserve stored answers; never use /profile,
        // which also replaces unrelated email/phone fields.
        if (trimmed && trimmed !== savedProfile.current.displayName) {
          const result = await apiFetch<{ ok: boolean }>('/anketa/name', {
            method: 'POST', body: JSON.stringify({ displayName: trimmed }),
          });
          if (result.ok !== true) throw new Error('Name save not confirmed');
          savedProfile.current.displayName = trimmed;
        }
        if (age !== '' && Number(age) !== savedProfile.current.age) {
          const result = await apiFetch<{ ok: boolean }>('/anketa/age', {
            method: 'POST', body: JSON.stringify({ age: Number(age) }),
          });
          if (result.ok !== true) throw new Error('Age save not confirmed');
          savedProfile.current.age = Number(age);
        }
        setName(savedProfile.current.displayName ?? '');
        setAge(savedProfile.current.age === null ? '' : String(savedProfile.current.age));
        setStep(3);
      } catch {
        setProfileError('Не удалось сохранить. Попробуйте ещё раз.');
      } finally {
        profileInFlight.current = false;
        setSavingProfile(false);
      }
      return;
    }
    if (step === 3 || step === 4) {
      answerInFlight.current = true;
      setSavingAnswer(true);
      setAnswerError('');
      const field = step === 3 ? 'cycleSituation' : 'mhtStatus';
      const value = step === 3 ? cycle : hrt;
      try {
        if (savedAnswers.current[field] !== value) {
          const result = await apiFetch<{ ok: boolean }>(step === 3 ? '/anketa/cycle-situation' : '/anketa/mht-status', {
            method: 'POST', body: JSON.stringify({ [field]: value }),
          });
          if (result.ok !== true) throw new Error('Answer save not confirmed');
          savedAnswers.current[field] = value;
        }
        setStep(step + 1);
      } catch {
        // A write may have succeeded even if its response was lost. Do not skip
        // a retry based on an older cached value, including a reselected answer.
        savedAnswers.current[field] = '';
        setAnswerError('Не удалось сохранить. Попробуйте ещё раз.');
      } finally {
        answerInFlight.current = false;
        setSavingAnswer(false);
      }
      return;
    }
    if (step === 5) {
      completionInFlight.current = true;
      setFinishing(true);
      setCompletionError('');
      try {
        await onCheckin();
      } catch {
        setCompletionError('Не удалось завершить сохранение. Попробуйте ещё раз.');
      } finally {
        completionInFlight.current = false;
        setFinishing(false);
      }
    } else setStep(step + 1);
  };
  const cta = step === 0 ? 'Начать мою историю 360°' : step === 5 ? 'Отметить самочувствие →' : 'Продолжить';

  useBackButton(step > 0 ? () => { if (!consentInFlight.current && !profileInFlight.current && !answerInFlight.current && !completionInFlight.current) back(); } : null);
  useMainButton({ text: cta, onClick: next, isVisible: false });
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [step]);

  return <main className="sw-onboarding" lang="ru">
    <header className="sw-onboarding-header">
      {step > 0 ? <button type="button" className="sw-onboarding-back" disabled={savingConsent || savingProfile || savingAnswer || finishing} onClick={() => { if (!consentInFlight.current && !profileInFlight.current && !answerInFlight.current && !completionInFlight.current) back(); }}>← Назад</button> : <span />}
      <span aria-label={`Шаг ${step + 1} из 6`}>{step + 1}/6</span>
    </header>
    <div className="sw-onboarding-progress" aria-hidden="true">
      {TITLES.map((title, index) => <span key={title} data-complete={index <= step} />)}
    </div>
    <section className="sw-onboarding-content">
      {step === 0 && <img className="sw-onboarding-logo" src={logo} alt="SanaWell AI" />}
      <h1 id="onboarding-title" tabIndex={-1} ref={heading}>{TITLES[step]}</h1>
      {step === 0 && <>
        <p>Ваше пространство для понимания самочувствия в пери- и менопаузе.<br />Отмечайте изменения, собирайте свою историю и наблюдайте личную динамику.</p>
        <p className="sw-onboarding-note">SanaWell AI — wellness-сервис. Не ставит диагнозы и не заменяет врача.</p>
      </>}
      {step === 1 && <>
        <p>SanaWell AI сохраняет информацию, которую вы сами добавляете о своём самочувствии, чтобы показывать вашу историю и личную динамику.</p>
        <div className="sw-onboarding-option sw-onboarding-consent">
          <input id="onboarding-terms" type="checkbox" checked={terms} disabled={savingConsent} onChange={(event) => { if (!consentInFlight.current) setTerms(event.target.checked); }} />
          <div><label htmlFor="onboarding-terms">Я принимаю Условия использования.</label>
            <a className="sw-onboarding-link" href={`${import.meta.env.BASE_URL}legal/mvp-draft-2026-09-23/terms.html`} target="_blank" rel="noopener noreferrer">Условия использования</a>
          </div>
        </div>
        <div className="sw-onboarding-option sw-onboarding-consent">
          <input id="onboarding-privacy" type="checkbox" checked={privacy} disabled={savingConsent} onChange={(event) => { if (!consentInFlight.current) setPrivacy(event.target.checked); }} />
          <div><label htmlFor="onboarding-privacy">Я ознакомилась с Политикой конфиденциальности и даю согласие на сбор и обработку персональных данных.</label>
            <a className="sw-onboarding-link" href={`${import.meta.env.BASE_URL}legal/mvp-draft-2026-09-23/privacy.html`} target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a>
            <a className="sw-onboarding-link" href={`${import.meta.env.BASE_URL}legal/mvp-draft-2026-09-23/data-consent.html`} target="_blank" rel="noopener noreferrer">Согласие на сбор и обработку персональных данных</a>
          </div>
        </div>
        <p className="sw-onboarding-note">Документы — рабочие проекты для закрытой MVP-фокус-группы. Перед публичным запуском требуется финальная юридическая проверка.</p>
        {savingConsent && <p role="status">Сохраняем ваши согласия…</p>}
        {consentError && <p role="alert">{consentError}</p>}
      </>}
      {step === 2 && <>
        <p>Это поможет SanaWell сделать вашу историю более личной.</p>
        <div className="sw-onboarding-fields">
          <label htmlFor="onboarding-name">Как к вам обращаться?</label>
          <input id="onboarding-name" autoComplete="given-name" maxLength={100} placeholder="Надира" value={name} disabled={profileBusy || profileStatus !== 'ready'} onChange={(event) => { if (!profileInFlight.current) setName(event.target.value); }} />
          <label htmlFor="onboarding-age">Сколько вам лет?</label>
          <input id="onboarding-age" type="text" inputMode="numeric" maxLength={3} placeholder="49" value={age}
            disabled={profileBusy || profileStatus !== 'ready'} onChange={(event) => { if (!profileInFlight.current) setAge(event.target.value); }} onBlur={() => setAgeTouched(true)}
            aria-invalid={ageTouched && invalidAge} aria-describedby={ageTouched && invalidAge ? 'onboarding-age-error' : undefined} />
          {ageTouched && invalidAge && <p id="onboarding-age-error" role="alert">Введите возраст целым числом от 18 до 100.</p>}
        </div>
        {profileBusy && <p role="status">{savingProfile ? 'Сохраняем…' : 'Загружаем ваши данные…'}</p>}
        {profileStatus === 'error' && <><p role="alert">Не удалось загрузить ваши данные. Попробуйте ещё раз.</p><button type="button" className="sw-onboarding-link" onClick={() => setProfileStatus('loading')}>Повторить загрузку</button></>}
        {profileError && <p role="alert">{profileError}</p>}
      </>}
      {step === 3 && <>
        <p>Что сейчас больше похоже на вашу ситуацию?<br />Выберите ближайший вариант — здесь нет правильного или неправильного ответа.</p>
        <Options name="cycle" options={CYCLE_OPTIONS} value={cycle} onChange={setCycle} disabled={answersStatus !== 'ready' || savingAnswer} />
      </>}
      {step === 4 && <>
        <p>Это поможет вашему дневнику лучше отражать вашу историю.<br />Мы не оцениваем и не корректируем назначенную терапию.</p>
        <Options name="hrt" options={HRT_OPTIONS} value={hrt} onChange={setHrt} disabled={answersStatus !== 'ready' || savingAnswer} />
      </>}
      {(step === 3 || step === 4) && <>
        {(answersStatus === 'loading' || savingAnswer) && <p role="status">{savingAnswer ? 'Сохраняем…' : 'Загружаем ваши данные…'}</p>}
        {answersStatus === 'error' && <><p role="alert">Не удалось загрузить ваши данные. Попробуйте ещё раз.</p><button type="button" className="sw-onboarding-link" onClick={() => setAnswersStatus('loading')}>Повторить загрузку</button></>}
        {answerError && <p role="alert">{answerError}</p>}
      </>}
      {step === 5 && <>
        <p>Теперь просто расскажите, как вы сегодня.<br />Это займёт меньше минуты.</p>
        <div className="sw-onboarding-note"><p>Ваши отметки будут складываться в личную историю.</p><p>Со временем вы сможете видеть, что меняется именно у вас.</p></div>
        {completionError && <p role="alert">{completionError}</p>}
      </>}
    </section>
    <footer className="sw-onboarding-footer"><button type="button" className="sw-onboarding-primary" disabled={!enabled || savingConsent || finishing} aria-busy={savingConsent || savingProfile || savingAnswer || finishing} onClick={next}>{savingConsent || savingProfile || savingAnswer || finishing ? 'Сохраняем…' : cta}</button></footer>
  </main>;
}
