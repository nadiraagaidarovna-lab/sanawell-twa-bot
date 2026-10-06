// analytics.ts — first-party interaction events (POST /api/events, backend/src/analytics.js).
// Off until the server reports a current consent; events before that are dropped, not buffered.
// Events carry only an event name and fixed fields (step number, section id, error kind,
// document key, seconds) — never answers, symptoms, texts or field values. No screen recording.
import { useEffect } from 'react';
import { isMiniAppActive } from '@telegram-apps/sdk';
import { ApiError } from './api';
import { getInitDataRaw } from './telegram';
import type { LegalDocumentKey } from './legalDocuments';

export type AnalyticsEvent =
  | { name: 'onboarding_step_view' | 'onboarding_step_done'; step: number }
  | { name: 'onboarding_error'; step: number; errorKind: ErrorKind }
  | { name: 'onboarding_completed' }
  | { name: 'section_open'; section: string }
  | { name: 'section_active_time'; section: string; seconds: number }
  | { name: 'legal_doc_open'; doc: LegalDocumentKey };

type ErrorKind = 'network' | 'server' | 'consent' | 'validation';

const MAX_BATCH = 20;
const MAX_SEGMENT_SECONDS = 3600;
let enabled = false;
let queue: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

export function setAnalyticsEnabled(value: boolean): void {
  enabled = value;
  if (!value) queue = [];
}

export function track(event: AnalyticsEvent): void {
  if (!enabled) return;
  queue.push(event);
  if (queue.length >= MAX_BATCH) flushAnalytics();
  else if (!timer) timer = setTimeout(flushAnalytics, 5000);
}

// keepalive lets the request finish while the app is being hidden or closed.
export function flushAnalytics(): void {
  if (timer) { clearTimeout(timer); timer = undefined; }
  while (queue.length > 0) {
    const events = queue.splice(0, MAX_BATCH);
    fetch('/api/events', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': getInitDataRaw() ?? '' },
      body: JSON.stringify({ events }),
    }).catch(() => { /* Analytics must never affect the app. */ });
  }
}

export function errorKindOf(error: unknown): ErrorKind {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'consent';
    if (error.status >= 500) return 'server';
    return 'validation';
  }
  return error instanceof TypeError ? 'network' : 'server';
}

// Visible = the page is visible AND Telegram reports the Mini App as active (not minimized).
function telegramActive(): boolean {
  try {
    return isMiniAppActive();
  } catch {
    return true;
  }
}
function appVisible(): boolean {
  return document.visibilityState === 'visible' && telegramActive();
}

// Send whatever is queued whenever the app is hidden, minimized or closed — on every screen,
// including onboarding steps that are not sections.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!appVisible()) flushAnalytics(); });
  window.addEventListener('pagehide', flushAnalytics);
  try {
    isMiniAppActive.sub((active: boolean) => { if (!active) flushAnalytics(); });
  } catch {
    /* Outside Telegram the signal may be unavailable; the browser events above still apply. */
  }
}

// Counts only time while the app is visible; background, minimizing and closing pause the clock.
// Each pause sends the accumulated seconds (≥ 1) for this section.
export function useSectionAnalytics(section: string | null): void {
  useEffect(() => {
    if (!section) return undefined;
    track({ name: 'section_open', section });
    let startedAt: number | null = appVisible() ? Date.now() : null;

    const pause = () => {
      if (startedAt === null) return;
      let seconds = Math.round((Date.now() - startedAt) / 1000);
      startedAt = null;
      while (seconds >= 1) {
        const part = Math.min(seconds, MAX_SEGMENT_SECONDS);
        track({ name: 'section_active_time', section, seconds: part });
        seconds -= part;
      }
    };
    const update = () => {
      if (appVisible()) {
        if (startedAt === null) startedAt = Date.now();
      } else {
        pause();
        flushAnalytics();
      }
    };
    const onPageHide = () => { pause(); flushAnalytics(); };

    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', onPageHide);
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = isMiniAppActive.sub(update);
    } catch {
      unsubscribe = undefined;
    }
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', onPageHide);
      unsubscribe?.();
      pause();
    };
  }, [section]);
}
