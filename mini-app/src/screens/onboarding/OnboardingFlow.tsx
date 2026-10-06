import { useEffect, useRef, useState } from 'react';
import logo from '../../assets/sanawell-logo.png';
import { getTelegramFirstName } from '../../lib/telegram';
import { useBackButton } from '../../lib/useBackButton';
import { useMainButton } from '../../lib/useMainButton';
import { apiFetch } from '../../lib/api';
import { legalDocumentTitle, legalDocumentUrl } from '../../lib/legalDocuments';
import { saveConsents } from '../../lib/onboardingFocusGroup';
import { errorKindOf, track } from '../../lib/analytics';
import { PRIORITY_UNSURE, TEXT, TITLES, TOPICS, WELCOME, topicTitle } from '../../content/onboardingV2';
import './OnboardingFlow.css';

// Seven screens: 0 welcome, 1 consent, 2 name, 3 topics, 4 main priority, 5 review, 6 start map.
// Self-reported choices only: no scoring, no stage, no medical conclusion anywhere.
const STEP = { welcome: 0, consent: 1, name: 2, topics: 3, priority: 4, review: 5, map: 6 } as const;
const TOTAL = TITLES.length;

interface MeOnboarding {
  consents?: { current?: boolean };
  displayName: string | null;
  focusTopics?: string[];
  focusPriority?: string | null;
}

/** Full-page message in the onboarding style (paused onboarding, failed start). */
export function OnboardingNotice({ title, text, actionLabel, onAction }: {
  title: string; text: string; actionLabel?: string; onAction?: () => void;
}) {
  return <main className="sw-onboarding" lang="ru">
    <section className="sw-onboarding-content">
      <img className="sw-onboarding-logo" src={logo} alt="SanaWell AI" />
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
    {actionLabel && onAction && <footer className="sw-onboarding-footer">
      <button type="button" className="sw-onboarding-primary" onClick={onAction}>{actionLabel}</button>
    </footer>}
  </main>;
}

/** Read-only repeat of the welcome page from the cabinet: no writes, answers and completion untouched. */
export function OnboardingWelcomeAgain({ onClose }: { onClose: () => void }) {
  useMainButton({ text: 'Вернуться', onClick: onClose, isVisible: false });
  return <main className="sw-onboarding" lang="ru">
    <section className="sw-onboarding-content">
      <img className="sw-onboarding-logo" src={logo} alt="SanaWell AI" />
      <h1>{WELCOME.title}</h1>
      <WelcomeText />
    </section>
    <footer className="sw-onboarding-footer">
      <button type="button" className="sw-onboarding-primary" onClick={onClose}>Вернуться</button>
    </footer>
  </main>;
}

function WelcomeText() {
  return <>
    <ul className="sw-onboarding-benefits">
      {WELCOME.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
    </ul>
    <p className="sw-onboarding-note">{WELCOME.note}</p>
  </>;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

/**
 * The new onboarding. Every answer is saved before moving on; reopening resumes from the saved
 * answers. consentOnly — just the consent page (re-consent of a completed account); editTopics —
 * topics and priority from the cabinet. onCheckin is called when the flow is finished.
 */
export default function OnboardingFlow({ onCheckin, consentOnly = false, editTopics = false }: {
  onCheckin: () => void | Promise<void>;
  consentOnly?: boolean;
  editTopics?: boolean;
}) {
  const full = !consentOnly && !editTopics;
  const [step, setStep] = useState<number>(consentOnly ? STEP.consent : editTopics ? STEP.topics : STEP.welcome);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(consentOnly ? 'ready' : 'loading');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [name, setName] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [priority, setPriority] = useState('');
  // What the server has confirmed; the review and the map show only this.
  const [saved, setSaved] = useState<{ name: string | null; topics: string[]; priority: string }>({ name: null, topics: [], priority: '' });
  const [returnToReview, setReturnToReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  // Re-consent page only: a woman who does not want to consent again can still request deletion.
  const [deletion, setDeletion] = useState<'idle' | 'confirm' | 'sending' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (loadStatus !== 'loading') return;
    let cancelled = false;
    apiFetch<MeOnboarding>('/me')
      .then((me) => {
        if (cancelled) return;
        const savedTopics = Array.isArray(me.focusTopics) ? me.focusTopics.filter((t) => TOPICS.some((x) => x.key === t)) : [];
        const savedPriority = typeof me.focusPriority === 'string' ? me.focusPriority : '';
        setSaved({ name: me.displayName, topics: savedTopics, priority: savedPriority });
        setName(me.displayName ?? getTelegramFirstName() ?? '');
        setTopics(savedTopics);
        setPriority(savedPriority);
        if (full) {
          // Resume from what is already saved; a completed step is never asked again blindly.
          setStep(me.consents?.current !== true ? STEP.welcome
            : savedTopics.length === 0 ? STEP.name
            : !savedPriority ? STEP.priority : STEP.review);
        }
        setLoadStatus('ready');
      })
      .catch(() => { if (!cancelled) setLoadStatus('error'); });
    return () => { cancelled = true; };
  }, [loadStatus, full]);

  useEffect(() => {
    if (loadStatus !== 'ready') return;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    // Dropped while there is no consent (analytics is off), so steps 1–2 are not recorded.
    if (full) track({ name: 'onboarding_step_view', step: step + 1 });
  }, [step, full, loadStatus]);
  const stepDone = (index: number) => { if (full) track({ name: 'onboarding_step_done', step: index + 1 }); };
  const stepError = (index: number, e: unknown) => {
    if (full) track({ name: 'onboarding_error', step: index + 1, errorKind: errorKindOf(e) });
  };

  const enabled = loadStatus === 'ready' && !busy && (
    step === STEP.consent ? terms && privacy
      : step === STEP.topics ? topics.length > 0
      : step === STEP.priority ? !!priority && (priority === PRIORITY_UNSURE || topics.includes(priority))
      : true);

  const go = (to: number) => { setError(''); setStep(to); };
  const goEdit = (to: number) => { setReturnToReview(true); go(to); };
  const back = () => {
    if (inFlight.current) return;
    setReturnToReview(false);
    go(Math.max(editTopics ? STEP.topics : 0, step - 1));
  };

  // Runs one save with a lock against double taps; errors are shown, never hidden.
  const run = async (index: number, action: () => Promise<void>, message: string) => {
    inFlight.current = true; setBusy(true); setError('');
    try {
      await action();
    } catch (e) {
      stepError(index, e);
      setError(message);
    } finally {
      inFlight.current = false; setBusy(false);
    }
  };

  const next = async () => {
    if (!enabled || inFlight.current) return;
    const index = step;
    if (step === STEP.welcome) { stepDone(index); go(STEP.consent); return; }
    if (step === STEP.consent) {
      await run(index, async () => {
        // Versioned, server-confirmed record; a retry after a lost response does not duplicate.
        await saveConsents(consentOnly ? 'reconsent' : 'onboarding_v2');
        stepDone(index);
        if (consentOnly) await onCheckin();
        else go(returnToReview ? STEP.review : STEP.name);
      }, 'Не удалось подтвердить сохранение согласий. Попробуйте ещё раз.');
      return;
    }
    if (step === STEP.name) {
      await run(index, async () => {
        const trimmed = name.trim();
        // Optional: blank keeps what is stored. Never /profile (it replaces email/phone too).
        if (trimmed && trimmed !== saved.name) {
          const result = await apiFetch<{ ok: boolean }>('/anketa/name', { method: 'POST', body: JSON.stringify({ displayName: trimmed }) });
          if (result.ok !== true) throw new Error('Name save not confirmed');
          setSaved((current) => ({ ...current, name: trimmed }));
        }
        stepDone(index);
        setReturnToReview(false);
        go(returnToReview ? STEP.review : STEP.topics);
      }, 'Не удалось сохранить. Попробуйте ещё раз.');
      return;
    }
    if (step === STEP.topics) {
      await run(index, async () => {
        let savedPriority = saved.priority;
        if (!sameSet(topics, saved.topics)) {
          const result = await apiFetch<{ ok: boolean; focusTopics: string[]; focusPriority: string | null }>(
            '/anketa/topics', { method: 'POST', body: JSON.stringify({ topics }) });
          if (result.ok !== true) throw new Error('Topics save not confirmed');
          // The server clears a priority that is no longer among the chosen topics.
          savedPriority = result.focusPriority ?? '';
          setSaved((current) => ({ ...current, topics: result.focusTopics, priority: savedPriority }));
          setPriority(savedPriority);
        }
        stepDone(index);
        const priorityStillValid = !!savedPriority;
        if (full && returnToReview && priorityStillValid) { setReturnToReview(false); go(STEP.review); }
        else go(STEP.priority);
      }, 'Не удалось сохранить. Попробуйте ещё раз.');
      return;
    }
    if (step === STEP.priority) {
      await run(index, async () => {
        if (priority !== saved.priority) {
          const result = await apiFetch<{ ok: boolean }>('/anketa/priority', { method: 'POST', body: JSON.stringify({ priority }) });
          if (result.ok !== true) throw new Error('Priority save not confirmed');
          setSaved((current) => ({ ...current, priority }));
        }
        stepDone(index);
        setReturnToReview(false);
        if (editTopics) await onCheckin();
        else go(STEP.review);
      }, 'Не удалось сохранить. Попробуйте ещё раз.');
      return;
    }
    if (step === STEP.review) { stepDone(index); go(STEP.map); return; }
    if (step === STEP.map) {
      await run(index, async () => { await onCheckin(); }, 'Не удалось завершить сохранение. Попробуйте ещё раз.');
    }
  };

  const requestDeletion = async () => {
    setDeletion('sending');
    try {
      await apiFetch('/account/delete-request', { method: 'POST' });
      setDeletion('done');
    } catch {
      setDeletion('error');
    }
  };

  const cta = step === STEP.welcome ? WELCOME.button
    : step === STEP.review ? TEXT.reviewButton
    : step === STEP.map ? TEXT.mapButton
    : editTopics && step === STEP.priority ? 'Сохранить' : 'Продолжить';
  const canGoBack = full ? step > STEP.welcome : editTopics && step > STEP.topics;

  useBackButton(canGoBack ? back : null);
  useMainButton({ text: cta, onClick: next, isVisible: false });

  if (loadStatus !== 'ready') {
    return <main className="sw-onboarding" lang="ru">
      <section className="sw-onboarding-content">
        {loadStatus === 'loading' ? <p role="status">Загружаем ваши данные…</p> : <>
          <p role="alert">Не удалось загрузить ваши данные. Попробуйте ещё раз.</p>
          <button type="button" className="sw-onboarding-link" onClick={() => setLoadStatus('loading')}>Повторить загрузку</button>
        </>}
      </section>
    </main>;
  }

  const priorityOptions = [...TOPICS.filter((t) => topics.includes(t.key)).map((t) => ({ key: t.key as string, label: t.title })),
    { key: PRIORITY_UNSURE as string, label: TEXT.priorityUnsure }];

  return <main className="sw-onboarding" lang="ru">
    {(full || canGoBack) && <header className="sw-onboarding-header">
      {canGoBack ? <button type="button" className="sw-onboarding-back" disabled={busy} onClick={back}>← Назад</button> : <span />}
      {full && <span aria-label={`Шаг ${step + 1} из ${TOTAL}`}>{step + 1}/{TOTAL}</span>}
    </header>}
    {full && <div className="sw-onboarding-progress" aria-hidden="true">
      {TITLES.map((title, index) => <span key={title} data-complete={index <= step} />)}
    </div>}
    <section className="sw-onboarding-content">
      {step === STEP.welcome && <img className="sw-onboarding-logo" src={logo} alt="SanaWell AI" />}
      <h1 id="onboarding-title" tabIndex={-1} ref={heading}>{TITLES[step]}</h1>
      {step === STEP.welcome && <WelcomeText />}

      {step === STEP.consent && <>
        <p>SanaWell AI сохраняет информацию, которую вы сами добавляете о своём самочувствии, чтобы показывать вашу историю и личную динамику.</p>
        <div className="sw-onboarding-option sw-onboarding-consent">
          <input id="onboarding-terms" type="checkbox" checked={terms} disabled={busy} onChange={(event) => { if (!inFlight.current) setTerms(event.target.checked); }} />
          <div><label htmlFor="onboarding-terms">Я принимаю Условия использования.</label>
            <a className="sw-onboarding-link" href={legalDocumentUrl('terms')} target="_blank" rel="noopener noreferrer" onClick={() => track({ name: 'legal_doc_open', doc: 'terms' })}>{legalDocumentTitle('terms')}</a>
          </div>
        </div>
        <div className="sw-onboarding-option sw-onboarding-consent">
          <input id="onboarding-privacy" type="checkbox" checked={privacy} disabled={busy} onChange={(event) => { if (!inFlight.current) setPrivacy(event.target.checked); }} />
          <div><label htmlFor="onboarding-privacy">Я ознакомилась с Политикой конфиденциальности и даю согласие на сбор и обработку персональных данных.</label>
            <a className="sw-onboarding-link" href={legalDocumentUrl('privacy')} target="_blank" rel="noopener noreferrer" onClick={() => track({ name: 'legal_doc_open', doc: 'privacy' })}>{legalDocumentTitle('privacy')}</a>
            <a className="sw-onboarding-link" href={legalDocumentUrl('dataConsent')} target="_blank" rel="noopener noreferrer" onClick={() => track({ name: 'legal_doc_open', doc: 'dataConsent' })}>{legalDocumentTitle('dataConsent')}</a>
          </div>
        </div>
        <p className="sw-onboarding-note">Документы — рабочие проекты для закрытой MVP-фокус-группы. Перед публичным запуском требуется финальная юридическая проверка.</p>
        {busy && <p role="status">Сохраняем ваши согласия…</p>}
        {consentOnly && <div className="sw-onboarding-note">
          {deletion === 'idle' && <><p>Если вы не хотите давать согласие, можно запросить удаление ваших данных.</p>
            <button type="button" className="sw-onboarding-link" onClick={() => setDeletion('confirm')}>Запросить удаление данных</button></>}
          {(deletion === 'confirm' || deletion === 'sending' || deletion === 'error') && <>
            <p>Запросить удаление аккаунта и данных? После обработки запроса удаление необратимо.</p>
            {deletion === 'error' && <p role="alert">Не удалось отправить запрос. Попробуйте ещё раз.</p>}
            <button type="button" className="sw-onboarding-link" disabled={deletion === 'sending'} onClick={requestDeletion}>
              {deletion === 'sending' ? 'Отправляем…' : 'Да, запросить удаление'}</button>
            <button type="button" className="sw-onboarding-link" disabled={deletion === 'sending'} onClick={() => setDeletion('idle')}>Отмена</button>
          </>}
          {deletion === 'done' && <p role="status">Запрос на удаление принят. Новые данные не сохраняются.</p>}
        </div>}
      </>}

      {step === STEP.name && <>
        <p>{TEXT.nameHint}</p>
        <div className="sw-onboarding-fields">
          <label htmlFor="onboarding-name">Имя</label>
          <input id="onboarding-name" autoComplete="given-name" maxLength={100} placeholder={TEXT.namePlaceholder} value={name}
            disabled={busy} onChange={(event) => { if (!inFlight.current) setName(event.target.value); }} />
        </div>
      </>}

      {step === STEP.topics && <>
        <p>{TEXT.topicsHint}</p>
        <fieldset className="sw-onboarding-options" aria-labelledby="onboarding-title" disabled={busy}>
          {TOPICS.map((topic) => <label className="sw-onboarding-option" key={topic.key}>
            <input type="checkbox" value={topic.key} checked={topics.includes(topic.key)}
              onChange={(event) => setTopics((current) => event.target.checked
                ? [...current, topic.key] : current.filter((t) => t !== topic.key))} />
            <span>{topic.title}</span>
          </label>)}
        </fieldset>
      </>}

      {step === STEP.priority && <>
        <p>{TEXT.priorityHint}</p>
        <fieldset className="sw-onboarding-options" aria-labelledby="onboarding-title" disabled={busy}>
          {priorityOptions.map((option) => <label className="sw-onboarding-option" key={option.key}>
            <input type="radio" name="priority" value={option.key} checked={priority === option.key} onChange={() => setPriority(option.key)} />
            <span>{option.label}</span>
          </label>)}
        </fieldset>
      </>}

      {step === STEP.review && <div className="sw-onboarding-review">
        {[
          [TEXT.reviewName, saved.name || TEXT.reviewNameEmpty, STEP.name],
          [TEXT.reviewTopics, saved.topics.map(topicTitle).join(', '), STEP.topics],
          [TEXT.reviewPriority, saved.priority === PRIORITY_UNSURE ? TEXT.priorityUnsure : topicTitle(saved.priority), STEP.priority],
        ].map(([label, value, target]) => <div className="sw-onboarding-review-row" key={label as string}>
          <div><span className="sw-onboarding-review-label">{label}</span><span>{value}</span></div>
          <button type="button" className="sw-onboarding-link" disabled={busy} onClick={() => goEdit(target as number)}
            aria-label={`${TEXT.edit}: ${label}`}>{TEXT.edit}</button>
        </div>)}
      </div>}

      {step === STEP.map && <>
        <div className="sw-onboarding-map-card sw-onboarding-map-focus">
          <span className="sw-onboarding-review-label">{TEXT.mapFocus}</span>
          <strong>{saved.priority === PRIORITY_UNSURE ? TEXT.mapFocusUnsure : topicTitle(saved.priority)}</strong>
        </div>
        <div className="sw-onboarding-map-card">
          <span className="sw-onboarding-review-label">{TEXT.mapTopics}</span>
          <ul className="sw-onboarding-map-list">
            {TOPICS.filter((t) => saved.topics.includes(t.key)).map((t) => <li key={t.key}>
              <span>{t.title}</span><span className="sw-onboarding-option-hint">{TEXT.mapWhere(t.homeCard)}</span>
            </li>)}
          </ul>
        </div>
        <p>{TEXT.mapNext}</p>
      </>}

      {error && <p role="alert">{error}</p>}
    </section>
    <footer className="sw-onboarding-footer"><button type="button" className="sw-onboarding-primary" disabled={!enabled} aria-busy={busy} onClick={next}>{busy ? 'Сохраняем…' : cta}</button></footer>
  </main>;
}
