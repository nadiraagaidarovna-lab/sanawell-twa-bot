// Telegram can restore a minimised Mini App without reloading it, so an open app may keep
// running a build from before the last deploy. On start and whenever the app becomes visible
// again, compare our own entry script with the one the server now serves and reload once.
import { isMiniAppActive } from '@telegram-apps/sdk';

const RELOAD_KEY = 'sw-build-reload';

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
  if (!server || server === own) return;
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
  void check(own);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check(own);
  });
  try {
    // Restoring a minimised Mini App does not always fire visibilitychange.
    isMiniAppActive.sub((active: boolean) => { if (active) void check(own); });
  } catch { /* outside Telegram: the browser event above still applies */ }
}
