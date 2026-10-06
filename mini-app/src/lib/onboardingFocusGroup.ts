import { apiFetch } from './api';
import { LEGAL_DOCUMENTS_VERSION, REQUIRED_CONSENT_DOCUMENTS } from './legalDocuments';
import { setAnalyticsEnabled } from './analytics';

// Which onboarding a woman gets is decided by the server (/me onboardingVersion), so the
// regular bot button opens it; no special link or start_param is needed any more.

export type ConsentSource = 'onboarding_v2' | 'legacy_consent_screen' | 'reconsent';

// Confirms both onboarding documents for the version whose links were shown. Resolves only
// after the server reports a current consent; anything else is an error for the caller to show.
export async function saveConsents(source: ConsentSource): Promise<void> {
  const result = await apiFetch<{ ok: boolean; current: boolean; version: string }>('/consents', {
    method: 'POST',
    body: JSON.stringify({ version: LEGAL_DOCUMENTS_VERSION, documents: REQUIRED_CONSENT_DOCUMENTS, source }),
  });
  if (result.ok !== true || result.current !== true || result.version !== LEGAL_DOCUMENTS_VERSION) {
    throw new Error('Consent save not confirmed');
  }
  setAnalyticsEnabled(true);
}

// Withdraws both documents. Resolves only when the server no longer reports any current consent.
export async function withdrawConsents(): Promise<void> {
  const result = await apiFetch<{ ok: boolean; current: boolean; terms: boolean; privacyDataConsent: boolean }>(
    '/consents/withdraw', { method: 'POST' });
  if (result.ok !== true || result.current !== false || result.terms || result.privacyDataConsent) {
    throw new Error('Withdrawal not confirmed');
  }
  setAnalyticsEnabled(false);
}

// Called only by the normal app's focus-group route, never the development preview.
export async function completeFocusGroupOnboarding(): Promise<void> {
  // Read each attempt so partial saves/lost responses never require undoing a flag.
  const me = await apiFetch<{ onboardingWelcomeSeen: boolean; onboardingAnketaCompleted: boolean }>('/me');
  if (typeof me.onboardingWelcomeSeen !== 'boolean' || typeof me.onboardingAnketaCompleted !== 'boolean') {
    throw new Error('Completion status unavailable');
  }
  for (const [saved, path] of [
    [me.onboardingWelcomeSeen, '/onboarding-welcome-seen'],
    [me.onboardingAnketaCompleted, '/anketa/complete'],
  ] as const) {
    if (!saved) {
      const result = await apiFetch<{ ok: boolean }>(path, { method: 'POST' });
      if (result.ok !== true) throw new Error('Completion save not confirmed');
    }
  }
}
