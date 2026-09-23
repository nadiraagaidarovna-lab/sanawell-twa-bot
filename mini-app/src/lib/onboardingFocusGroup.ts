import { apiFetch } from './api';
import { getInitDataRaw } from './telegram';

export function requestedFocusGroupOnboarding(): boolean {
  if (new URLSearchParams(window.location.search).get('onboarding') === 'focus-group') return true;
  try {
    return new URLSearchParams(getInitDataRaw() ?? '').get('start_param') === 'onboarding_focus_group';
  } catch {
    return false;
  }
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
