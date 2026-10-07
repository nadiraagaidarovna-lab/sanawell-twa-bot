// Telegram can restore a minimised Mini App without reloading it, so an open app may keep
// running a build from before the last deploy. On start and whenever the app becomes visible
// again, compare our own entry script with the one the server now serves and reload once.
import { useEffect, useId } from 'react';
import { isMiniAppActive } from '@telegram-apps/sdk';

const RELOAD_KEY = 'sw-build-reload';

// A reload must never drop answers she has not saved yet. Screens with a form report it here;
// anything typed into a field also counts until she moves to another screen. While anything is
// unsaved the reload waits for the next return to the app.
const unsaved = new Set<string>();
let typedOnThisScreen = false;

export function useUnsavedWork(dirty: boolean) {
  const id = useId();
  useEffect(() => {
    if (!dirty) return;
    unsaved.add(id);
    return () => { unsaved.delete(id); };
  }, [dirty, id]);
}

/** Called by navigation on every screen change. */
export function screenChanged() {
  typedOnThisScreen = false;
}

export function hasUnsavedWork(): boolean {
  return unsaved.size > 0 || typedOnThisScreen;
}

function ownBuild(): string | null {
  try {
    return new URL(import.meta.url).pathname.split('/').pop() || null;
  } catch {
    return null;
  }
}

async function check(own: string) {
  let server: string | null = null;
  try {
    const res = await fetch('/checkin/build.json', { cache: 'no-store' });
    if (!res.ok) return;
    server = ((await res.json()) as { build?: string | null }).build ?? null;
  } catch {
    return;
  }
  if (!server || server === own || hasUnsavedWork()) return;
  // One reload per new build: if a deploy is still switching instances, do not loop.
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === server) return;
    sessionStorage.setItem(RELOAD_KEY, server);
  } catch { /* storage unavailable: reload anyway */ }
  window.location.reload();
}

export function startBuildCheck() {
  if (import.meta.env.DEV) return;
  const own = ownBuild();
  if (!own || !own.startsWith('index-')) return;
  const typed = () => { typedOnThisScreen = true; };
  document.addEventListener('input', typed, true);
  document.addEventListener('change', typed, true);
  void check(own);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check(own);
  });
  try {
    // Restoring a minimised Mini App does not always fire visibilitychange.
    isMiniAppActive.sub((active: boolean) => { if (active) void check(own); });
  } catch { /* outside Telegram: the browser event above still applies */ }
}
