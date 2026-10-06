// Normal App route (never onboarding-preview). All APIs mocked; no user data.
// Also runs against `vite preview` with FOCUS_GROUP_TEST_PRODUCTION=1.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FOCUS_GROUP_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';
const production = process.env.FOCUS_GROUP_TEST_PRODUCTION === '1';
const welcomePath = '/api/onboarding-welcome-seen';
const completePath = '/api/anketa/complete';
const legal = require('../src/lib/legal-documents.json');
const recordFor = overrides => ({
  onboardingVersion: 'v2', consents: { current: false }, onboardingWelcomeSeen: false, onboardingAnketaCompleted: false,
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
    // The server decides the version; the regular bot button (no query, no start_param) is enough.
    for (const [name, overrides, selector, newFlow] of [
      ['v2-regular-button', {}, 'text=Добро пожаловать в SanaWell AI', true],
      ['v2-ignores-old-opt-in-absence', { onboardingWelcomeSeen: true }, 'text=Добро пожаловать в SanaWell AI', true],
      ['legacy-new', { onboardingVersion: 'legacy' }, '.onboarding-welcome', false],
      ['legacy-incomplete', { onboardingVersion: 'legacy', onboardingWelcomeSeen: true, consents: { current: true } }, '#anketa-name', false],
      ['legacy-incomplete-no-consent', { onboardingVersion: 'legacy', onboardingWelcomeSeen: true }, '.consent-policy-link >> nth=0', false],
      ['missing-version-is-not-v2', { onboardingVersion: undefined }, '.onboarding-welcome', false],
      ['paused', { onboardingVersion: 'paused' }, 'text=Знакомство временно недоступно', true],
      ['completed', { onboardingWelcomeSeen: true, onboardingAnketaCompleted: true, consents: { current: true } }, '.sw-greeting', false],
      ['completed-legacy-account', { onboardingVersion: 'legacy', onboardingWelcomeSeen: true, onboardingAnketaCompleted: true, consents: { current: true } }, '.sw-greeting', false],
      ['completed-paused', { onboardingVersion: 'paused', onboardingWelcomeSeen: true, onboardingAnketaCompleted: true, consents: { current: true } }, '.sw-greeting', false],
      ['completed-needs-reconsent', { onboardingWelcomeSeen: true, onboardingAnketaCompleted: true }, 'text=Ваши данные — под вашим контролем', true],
    ]) {
      const page = await telegramPage(browser); const record = recordFor(overrides); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => { if (new URL(route.request().url()).pathname === '/api/events') { (globalThis.analyticsBatches ||= []).push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); } 
        assert.equal(route.request().method(), 'GET');
        const path = new URL(route.request().url()).pathname;
        return path === '/api/me' ? route.fulfill({ json: record }) : normalRead(route, path);
      });
      await page.goto(base); await page.locator(selector).waitFor();
      assert.equal(await page.locator('.sw-onboarding').count() > 0, newFlow, name);
      if (name === 'completed-needs-reconsent') assert.equal(await page.locator('.sw-onboarding-progress').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS gate: ${name}`); await page.close();
    }
    {
      const page = await telegramPage(browser); let failing = true;
      await page.route('**/api/**', route => { if (new URL(route.request().url()).pathname === '/api/events') { (globalThis.analyticsBatches ||= []).push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); } 
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/me') return failing ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: recordFor({}) });
        return normalRead(route, path);
      });
      await page.goto(base); await page.getByRole('heading', { name: 'Не удалось загрузить данные' }).waitFor();
      assert.equal(await page.locator('.onboarding-welcome').count(), 0); // never a guessed flow
      failing = false; await page.getByRole('button', { name: 'Повторить', exact: true }).click();
      await page.getByText('Добро пожаловать в SanaWell AI').waitFor();
      console.log('PASS gate: start failure shows retry, then the server-chosen flow'); await page.close();
    }
    {
      // «Показать приветствие снова»: the new welcome page, view only, no writes.
      const page = await telegramPage(browser); const writes = [];
      const record = recordFor({ onboardingWelcomeSeen: true, onboardingAnketaCompleted: true, consents: { current: true } });
      await page.route('**/api/**', route => { if (new URL(route.request().url()).pathname === '/api/events') { (globalThis.analyticsBatches ||= []).push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); } 
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() !== 'GET') { writes.push(path); return route.fulfill({ json: { ok: true } }); }
        return path === '/api/me' ? route.fulfill({ json: record }) : normalRead(route, path);
      });
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      await page.getByRole('button', { name: 'Профиль', exact: true }).click();
      await page.getByRole('button', { name: 'Показать приветствие снова', exact: true }).click();
      await page.getByRole('heading', { name: 'Добро пожаловать в SanaWell AI' }).waitFor();
      assert.equal(await page.locator('.sw-onboarding-progress').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Начать мою историю 360°' }).count(), 0);
      await page.getByRole('button', { name: 'Вернуться', exact: true }).click();
      await page.getByRole('button', { name: 'Показать приветствие снова', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Показать приветствие снова', exact: true }).click();
      await page.getByRole('heading', { name: 'Добро пожаловать в SanaWell AI' }).waitFor();
      await back(page); await page.getByRole('button', { name: 'Показать приветствие снова', exact: true }).waitFor();
      assert.deepEqual(writes, []);
      console.log('PASS welcome again: new welcome, read-only, returns to the cabinet'); await page.close();
    }
    {
      // Withdrawal from the cabinet, then the deletion request from the re-consent page.
      const page = await telegramPage(browser); const writes = [];
      const record = recordFor({ onboardingWelcomeSeen: true, onboardingAnketaCompleted: true, consents: { current: true }, reminderOptIn: true });
      let failWithdraw = true;
      await page.route('**/api/**', route => { if (new URL(route.request().url()).pathname === '/api/events') { (globalThis.analyticsBatches ||= []).push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); } 
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() === 'GET') return path === '/api/me' ? route.fulfill({ json: record }) : normalRead(route, path);
        writes.push(path);
        if (path === '/api/consents/withdraw') {
          if (failWithdraw) { failWithdraw = false; return route.fulfill({ status: 503, json: {} }); }
          record.consents = { current: false };
          return route.fulfill({ json: { ok: true, current: false, terms: false, privacyDataConsent: false, version: legal.version } });
        }
        if (path === '/api/account/delete-request') return route.fulfill({ json: { ok: true } });
        throw new Error(`Unexpected write: ${path}`);
      });
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      await page.getByRole('button', { name: 'Профиль', exact: true }).click();
      await page.getByRole('button', { name: 'Отозвать согласие', exact: true }).click();
      await page.getByText('Отозвать согласие?').waitFor();
      await page.getByRole('button', { name: 'Отмена', exact: true }).first().click();
      assert.deepEqual(writes, []); // cancel writes nothing
      await page.getByRole('button', { name: 'Отозвать согласие', exact: true }).click();
      await page.getByRole('button', { name: 'Отозвать', exact: true }).click();
      await page.getByText('Не удалось отозвать согласие').waitFor(); // failure is visible, no fake success
      await page.getByRole('button', { name: 'Отозвать', exact: true }).click();
      await page.getByText('Согласие отозвано. Новые данные не сохраняются.').waitFor();
      assert.equal(await page.locator('.cabinet-link').count(), 3); // documents stay available
      assert(await page.getByRole('button', { name: 'Удалить аккаунт', exact: true }).isVisible());
      // Next open: completed account without consent -> re-consent page, which offers deletion.
      await page.goto(base); await page.getByText('Ваши данные — под вашим контролем').waitFor();
      assert.equal(await page.getByRole('link', { name: 'Условия использования', exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Запросить удаление данных', exact: true }).click();
      await page.getByRole('button', { name: 'Да, запросить удаление', exact: true }).click();
      await page.getByText('Запрос на удаление принят').waitFor();
      assert.deepEqual(writes, ['/api/consents/withdraw', '/api/consents/withdraw', '/api/account/delete-request']);
      console.log('PASS withdrawal: two-step, visible failure, documents and deletion stay available'); await page.close();
    }
    for (const scenario of ['success','first-fails','second-fails','lost-first','lost-second','status-fails','invalid-status','unconfirmed','duplicate','partial-existing','progress']) {
      const page = await telegramPage(browser);
      const record = recordFor({ onboardingWelcomeSeen: scenario === 'partial-existing' });
      let finalStep = false, failed = false, checkin = null, release, started, consentWrites = 0;
      const writes = [], errors = [];
      const barrier = new Promise(resolve => { release = resolve; });
      const waiting = new Promise(resolve => { started = resolve; });
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => { if (new URL(route.request().url()).pathname === '/api/events') { (globalThis.analyticsBatches ||= []).push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); } 
        const request = route.request(), path = new URL(request.url()).pathname;
        if (path === '/api/me') {
          if (finalStep && !failed && ['status-fails','invalid-status'].includes(scenario)) {
            failed = true; return route.fulfill({ status: scenario === 'status-fails' ? 503 : 200, json: {} });
          }
          return route.fulfill({ json: record });
        }
        if (request.method() === 'GET') return normalRead(route, path, checkin);
        if (path === '/api/consents') {
          assert.deepEqual(request.postDataJSON(), { version: legal.version, documents: ['terms', 'privacy_data_consent'], source: 'onboarding_v2' });
          record.consents = { current: true }; consentWrites++;
          return route.fulfill({ json: { ok: true, current: true, version: legal.version } });
        }
        if (path === '/api/checkin') {
          assert(record.onboardingWelcomeSeen && record.onboardingAnketaCompleted && record.consents.current);
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
      await page.goto(base);
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
      assert.equal(consentWrites, 1);
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
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      assert.equal(writes.length, savedWrites); assert.deepEqual(errors, []);
      console.log(`PASS completion/navigation: ${scenario}`); await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
