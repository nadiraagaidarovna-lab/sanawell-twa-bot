// Normal App route (never onboarding-preview). All APIs mocked; no user data.
// Also runs against `vite preview` with FOCUS_GROUP_TEST_PRODUCTION=1.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FOCUS_GROUP_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';
const production = process.env.FOCUS_GROUP_TEST_PRODUCTION === '1';
const welcomePath = '/api/onboarding-welcome-seen';
const completePath = '/api/anketa/complete';
const recordFor = overrides => ({
  newOnboardingTester: true, onboardingWelcomeSeen: false, onboardingAnketaCompleted: false,
  medicalDisclaimerConsented: true, dataStorageConsented: true, onboarded: false,
  displayName: 'Надира', age: 49, cycleSituation: 'unsure', mhtStatus: 'prefer_not_to_say',
  language: 'ru', menopausePath: null, symptomChecklist: null, ...overrides,
});
async function telegramPage(browser, startParam) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => console.error('Browser error:', error.message));
  if (production) await page.addInitScript(({ startParam }) => {
    // Synthetic native Telegram shell for the built production bundle only.
    const data = new URLSearchParams({ user: JSON.stringify({ id: 101, first_name: 'Надира', language_code: 'ru' }), auth_date: String(Math.floor(Date.now() / 1000)), hash: 'test-only-mocked-api', signature: 'test-only-mocked-api' });
    if (startParam) data.set('start_param', startParam);
    const params = new URLSearchParams({ tgWebAppData: data.toString(), tgWebAppVersion: '8.0', tgWebAppPlatform: 'android', tgWebAppThemeParams: JSON.stringify({ bg_color: '#ffffff', text_color: '#000000', button_color: '#C1613F', button_text_color: '#ffffff' }) });
    history.replaceState(null, '', location.pathname + location.search + '#' + params);
    window.TelegramWebviewProxy = { postEvent(name) {
      const reply = (event, payload) => setTimeout(() => window.Telegram?.WebView?.receiveEvent(event, payload), 0);
      if (name === 'web_app_request_viewport') reply('viewport_changed', { height: 844, width: 390, is_expanded: true, is_state_stable: true });
      if (name === 'web_app_request_theme') reply('theme_changed', { theme_params: { bg_color: '#ffffff', text_color: '#000000' } });
      if (name === 'web_app_request_safe_area') reply('safe_area_changed', { top: 0, bottom: 0, left: 0, right: 0 });
      if (name === 'web_app_request_content_safe_area') reply('content_safe_area_changed', { top: 0, bottom: 0, left: 0, right: 0 });
    } };
  }, { startParam });
  return page;
}
async function back(page) {
  await page.evaluate(() => window.Telegram.WebView.receiveEvent('back_button_pressed'));
}
async function normalRead(route, path, checkin = null) {
  if (path === '/api/checkin') return route.fulfill({ json: { checkin } });
  if (path === '/api/checkin/history') return route.fulfill({ json: { history: [] } });
  if (path === '/api/checkin/weekly-report') return route.fulfill({ json: { recommendations: [], doctorNudge: { show: false, text: null } } });
  if (path === '/api/checkin/summary') return route.fulfill({ json: { daysCount: checkin ? 1 : 0, lastCheckinDate: null } });
  throw new Error(`Unexpected request: ${path}`);
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const [name, overrides, query, selector] of [
      ['outsider-with-link', { newOnboardingTester: false }, '?onboarding=focus-group', '.onboarding-welcome'],
      ['old-incomplete', { newOnboardingTester: false, onboardingWelcomeSeen: true }, '?onboarding=focus-group', '#anketa-name'],
      ['tester-without-opt-in', {}, '', '.onboarding-welcome'],
      ['wrong-opt-in', {}, '?onboarding=other', '.onboarding-welcome'],
      ['missing-server-flag', { newOnboardingTester: undefined }, '?onboarding=focus-group', '.onboarding-welcome'],
      ['malformed-server-flag', { newOnboardingTester: 'true' }, '?onboarding=focus-group', '.onboarding-welcome'],
      ['completed-tester', { onboardingWelcomeSeen: true, onboardingAnketaCompleted: true }, '?onboarding=focus-group', '.sw-greeting'],
      ['completed-outsider', { newOnboardingTester: false, onboardingWelcomeSeen: true, onboardingAnketaCompleted: true }, '', '.sw-greeting'],
      ['completed-missing-consent', { onboardingWelcomeSeen: true, onboardingAnketaCompleted: true, dataStorageConsented: false }, '?onboarding=focus-group', '.consent-policy-link'],
    ]) {
      const page = await telegramPage(browser); const record = recordFor(overrides); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => {
        assert.equal(route.request().method(), 'GET');
        const path = new URL(route.request().url()).pathname;
        return path === '/api/me' ? route.fulfill({ json: record }) : normalRead(route, path);
      });
      await page.goto(base + query); await page.locator(selector).waitFor();
      assert.equal(await page.locator('.sw-onboarding').count(), 0); assert.deepEqual(errors, []);
      console.log(`PASS gate: ${name}`); await page.close();
    }
    for (const scenario of ['success','first-fails','second-fails','lost-first','lost-second','status-fails','invalid-status','unconfirmed','duplicate','partial-existing','progress', ...(production ? ['telegram-start-param'] : [])]) {
      const page = await telegramPage(browser, scenario === 'telegram-start-param' ? 'onboarding_focus_group' : undefined);
      const record = recordFor({ onboardingWelcomeSeen: scenario === 'partial-existing' });
      let finalStep = false, failed = false, checkin = null, release, started;
      const writes = [], errors = [];
      const barrier = new Promise(resolve => { release = resolve; });
      const waiting = new Promise(resolve => { started = resolve; });
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (path === '/api/me') {
          if (finalStep && !failed && ['status-fails','invalid-status'].includes(scenario)) {
            failed = true; return route.fulfill({ status: scenario === 'status-fails' ? 503 : 200, json: {} });
          }
          return route.fulfill({ json: record });
        }
        if (request.method() === 'GET') return normalRead(route, path, checkin);
        if (path === '/api/checkin') {
          assert(record.onboardingWelcomeSeen && record.onboardingAnketaCompleted);
          const data = request.postDataJSON();
          checkin = { sleepScore: data.sleep, moodScore: data.mood, memoryScore: data.memory, energyScore: null, hot_flashes: null, comment: null, canCorrect: true };
          return route.fulfill({ json: { ok: true, checkin } });
        }
        assert([welcomePath, completePath].includes(path), `Unrelated write: ${path}`);
        assert.equal(request.postData(), null); writes.push(path);
        if (scenario === 'duplicate' && path === welcomePath) { started(); await barrier; }
        if (!failed && ((['first-fails','lost-first'].includes(scenario) && path === welcomePath) || (['second-fails','lost-second','unconfirmed'].includes(scenario) && path === completePath))) {
          failed = true;
          if (scenario.startsWith('lost-')) {
            record[path === welcomePath ? 'onboardingWelcomeSeen' : 'onboardingAnketaCompleted'] = true;
            return route.abort();
          }
          return route.fulfill({ status: scenario === 'unconfirmed' ? 200 : 503, json: {} });
        }
        record[path === welcomePath ? 'onboardingWelcomeSeen' : 'onboardingAnketaCompleted'] = true;
        return route.fulfill({ json: { ok: true } });
      });
      await page.goto(base + (scenario === 'telegram-start-param' ? '' : '?onboarding=focus-group'));
      assert.equal(await page.locator('aside').count(), 0); // No preview wrapper.
      await page.getByRole('button', { name: 'Начать мою историю 360°' }).click();
      await page.getByRole('checkbox').nth(0).check(); await page.getByRole('checkbox').nth(1).check();
      const next = page.getByRole('button', { name: 'Продолжить', exact: true }); await next.click();
      await page.waitForFunction(() => !document.querySelector('#onboarding-name')?.disabled); await next.click();
      await page.waitForFunction(() => !!document.querySelector('input[value=unsure]:checked') && !document.querySelector('fieldset').disabled); await next.click();
      await page.locator('input[value=prefer_not_to_say]:checked').waitFor(); await next.click();
      await page.getByRole('heading', { name: 'Начнём вашу историю 360°' }).waitFor(); finalStep = true;
      assert.deepEqual(writes, []);
      const finish = page.getByRole('button', { name: 'Отметить самочувствие →', exact: true });
      if (scenario === 'duplicate') {
        await finish.evaluate(b => { b.click(); b.click(); b.click(); }); await waiting;
        assert(await page.getByRole('button', { name: 'Сохраняем…', exact: true }).isDisabled());
        assert(await page.getByRole('button', { name: '← Назад' }).isDisabled());
        await back(page); assert(await page.getByRole('heading', { name: 'Начнём вашу историю 360°' }).isVisible()); release();
      } else await finish.click();
      if (['first-fails','second-fails','lost-first','lost-second','status-fails','invalid-status','unconfirmed'].includes(scenario)) {
        await page.getByRole('alert').waitFor();
        assert(await page.getByRole('heading', { name: 'Начнём вашу историю 360°' }).isVisible());
        assert.equal(await page.locator('.checkin-fields').count(), 0); await finish.click();
      }
      await page.locator('.checkin-fields').waitFor();
      assert(record.onboardingWelcomeSeen && record.onboardingAnketaCompleted);
      assert.equal(record.menopausePath, null);
      assert.equal(writes.filter(p => p === welcomePath).length, scenario === 'partial-existing' ? 0 : scenario === 'first-fails' ? 2 : 1);
      assert.equal(writes.filter(p => p === completePath).length, ['second-fails','unconfirmed'].includes(scenario) ? 2 : 1);
      const savedWrites = writes.length;
      if (['success','progress'].includes(scenario)) {
        for (const name of ['Сон','Настроение','Ясность / концентрация']) await page.getByRole('group', { name, exact: true }).getByRole('button', { name: '5 из 10', exact: true }).click();
        await page.getByRole('button', { name: 'Сохранить отметку', exact: true }).click();
        await page.getByRole('heading', { name: 'Моя Карта самочувствия 360°' }).waitFor();
        if (scenario === 'progress') {
          await page.getByRole('button', { name: 'Посмотреть динамику', exact: true }).click();
          await page.getByRole('heading', { name: 'Самочувствие', exact: true }).waitFor(); await back(page);
          await page.getByRole('heading', { name: 'Спасибо 🤍', exact: true }).waitFor();
          await back(page);
        } else await page.getByRole('button', { name: 'Готово', exact: true }).click();
        await page.locator('.sw-greeting').waitFor();
      } else { await back(page); await page.locator('.sw-greeting').waitFor(); }
      // Drain Back history: none of it may reopen completed onboarding.
      for (let i = 0; i < 4; i++) { await back(page); await page.waitForTimeout(30); assert.equal(await page.locator('.sw-onboarding').count(), 0); }
      await page.goto(base + '?onboarding=focus-group'); await page.locator('.sw-greeting').waitFor();
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      assert.equal(writes.length, savedWrites); assert.deepEqual(errors, []);
      console.log(`PASS completion/navigation: ${scenario}`); await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
