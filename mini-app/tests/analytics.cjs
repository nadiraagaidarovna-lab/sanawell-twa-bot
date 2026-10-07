// Run against Vite dev: ANALYTICS_TEST_BASE_URL=http://127.0.0.1:5175/checkin/
// All /api requests are intercepted. These tests never contact a real backend.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const legal = require('../src/lib/legal-documents.json');
const base = process.env.ANALYTICS_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';
const ALLOWED = {
  onboarding_step_view: ['step'], onboarding_step_done: ['step'], onboarding_error: ['step', 'errorKind'],
  onboarding_completed: [], section_open: ['section'], section_active_time: ['section', 'seconds'], legal_doc_open: ['doc'],
};

function mock(page, record, log) {
  return page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/events') { log.push({ at: log.length, events: request.postDataJSON().events }); return route.fulfill({ json: { ok: true } }); }
    log.push({ at: log.length, path });
    if (path === '/api/me') return route.fulfill({ json: record });
    if (path === '/api/consents') { record.consents = { current: true }; return route.fulfill({ json: { ok: true, current: true, version: legal.version } }); }
    if (path === '/api/anketa/topics') return route.fulfill({ json: { ok: true, focusTopics: request.postDataJSON().topics, focusPriority: null } });
    if (path.startsWith('/api/anketa/')) return route.fulfill({ json: { ok: true } });
    if (path === '/api/checkin') return route.fulfill({ json: { checkin: null } });
    if (path === '/api/checkin/history') return route.fulfill({ json: { history: [] } });
    if (path === '/api/checkin/weekly-report') return route.fulfill({ json: { recommendations: [], doctorNudge: { show: false, text: null } } });
    if (path === '/api/today-action') return route.fulfill({ json: { needsTopic: true, priority: null, options: [] } });
    if (path === '/api/checkin/summary') return route.fulfill({ json: { daysCount: 0, lastCheckinDate: null } });
    throw new Error(`Unexpected request: ${path}`);
  });
}
const events = log => log.filter(e => e.events).flatMap(e => e.events);
async function setVisible(page, visible) {
  await page.evaluate(v => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
}
function assertClean(all, forbidden) {
  for (const e of all) {
    assert(ALLOWED[e.name], `unknown event ${e.name}`);
    assert.deepEqual(Object.keys(e).filter(k => k !== 'name').sort(), [...ALLOWED[e.name]].sort(), JSON.stringify(e));
  }
  const text = JSON.stringify(all);
  for (const value of forbidden) assert(!text.includes(value), `leaked ${value}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.ANALYTICS_TEST_BROWSER || 'msedge' });
  try {
    {
      // New woman: nothing before consent; afterwards only step numbers, no answers.
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const log = [];
      const record = { onboardingVersion: 'v2', onboardingAnketaCompleted: false, onboardingWelcomeSeen: false,
        consents: { current: false }, displayName: null, focusTopics: [], focusPriority: null };
      await mock(page, record, log);
      await page.goto(base);
      await page.getByRole('button', { name: 'Начать знакомство' }).click();
      await page.getByRole('link', { name: 'Условия использования', exact: true }).evaluate(a => a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
      await page.getByRole('checkbox').nth(0).check(); await page.getByRole('checkbox').nth(1).check();
      await setVisible(page, false); await setVisible(page, true); // a flush attempt before consent
      await page.waitForTimeout(300);
      assert.equal(events(log).length, 0, 'no events before consent');
      const next = page.getByRole('button', { name: 'Продолжить', exact: true });
      await next.click();
      await page.getByRole('heading', { name: 'Как к вам обращаться?' }).waitFor();
      await page.getByLabel('Имя').fill('Надира'); await next.click();
      await page.getByRole('heading', { name: 'Что для вас сейчас важно?' }).waitFor();
      await page.locator('input[value=emotions]').check(); await next.click();
      await page.getByRole('heading', { name: 'Что для вас главное сейчас?' }).waitFor();
      await setVisible(page, false); // flush
      await page.waitForTimeout(300);
      const all = events(log);
      const consentAt = log.findIndex(e => e.path === '/api/consents');
      assert(log.filter(e => e.events).every(e => e.at > consentAt), 'events only after consent');
      assert.deepEqual(all.filter(e => e.name === 'onboarding_step_done').map(e => e.step), [2, 3, 4]);
      assert.deepEqual(all.filter(e => e.name === 'onboarding_step_view').map(e => e.step), [3, 4, 5]);
      assert(!all.some(e => e.step === 1) && !all.some(e => e.name === 'legal_doc_open'), 'pre-consent actions dropped');
      assertClean(all, ['Надира', 'emotions', 'Эмоциональное', 'Тест']);
      console.log(`PASS onboarding: nothing before consent, ${all.length} step events, no answers`);
      await page.close();
    }
    {
      // Completed woman: section open + active time only while visible; background excluded.
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const log = [];
      const record = { onboardingVersion: 'v2', onboardingAnketaCompleted: true, onboardingWelcomeSeen: true,
        consents: { current: true }, displayName: 'Надира', age: 49, reminderOptIn: false, habitsReminderOptIn: false };
      await mock(page, record, log);
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      await page.waitForTimeout(2200);
      await setVisible(page, false);           // background
      await page.waitForTimeout(3000);         // must not be counted
      await setVisible(page, true);
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: 'Профиль', exact: true }).click();
      await page.getByRole('link', { name: 'Политика конфиденциальности', exact: true }).evaluate(a => a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
      await setVisible(page, false); await page.waitForTimeout(300);
      const all = events(log);
      // Dev StrictMode mounts effects twice; collapse adjacent duplicates (production mounts once).
      assert.deepEqual(all.filter(e => e.name === 'section_open').map(e => e.section).filter((v, i, a) => v !== a[i - 1]), ['home', 'cabinet']);
      const homeSeconds = all.filter(e => e.name === 'section_active_time' && e.section === 'home').reduce((s, e) => s + e.seconds, 0);
      assert(homeSeconds >= 2 && homeSeconds <= 4, `home active seconds ${homeSeconds} (background excluded)`);
      assert(all.some(e => e.name === 'legal_doc_open' && e.doc === 'privacy'));
      assertClean(all, ['Надира', '"49"']);
      console.log(`PASS sections: open + ${homeSeconds}s visible on Home, background excluded`);
      await page.close();
    }
    {
      // Completed woman without current consent (re-consent page): nothing is sent.
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const log = [];
      const record = { onboardingVersion: 'v2', onboardingAnketaCompleted: true, onboardingWelcomeSeen: true, consents: { current: false } };
      await mock(page, record, log);
      await page.goto(base); await page.getByText('Ваши данные — под вашим контролем').waitFor();
      await page.waitForTimeout(1200); await setVisible(page, false); await page.waitForTimeout(300);
      assert.equal(events(log).length, 0);
      console.log('PASS re-consent page: no analytics without consent');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
