// Run against Vite dev: CONSENT_TEST_BASE_URL=http://127.0.0.1:5175/checkin/
// Use installed Playwright, or point PLAYWRIGHT_MODULE at an existing installation.
// All /api requests are intercepted. These tests never contact a real backend.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CONSENT_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';
const legal = require(path.resolve(__dirname, '../src/lib/legal-documents.json'));
const EXPECTED = { version: legal.version, documents: ['terms', 'privacy_data_consent'], source: 'onboarding_v2' };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CONSENT_TEST_BROWSER || 'msedge' });
  try {
    for (const scenario of ['success', 'fails', 'lost-response', 'unconfirmed-save', 'stale-version', 'already-current']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      let current = scenario === 'already-current';
      const writes = []; const errors = []; let failed = false;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', async route => { if (new URL(route.request().url()).pathname === '/api/events') { (globalThis.analyticsBatches ||= []).push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); } 
        const request = route.request(); const url = new URL(request.url()).pathname;
        assert('x-telegram-init-data' in request.headers());
        if (url === '/api/me') return route.fulfill({ json: { onboardingVersion: 'v2', onboardingAnketaCompleted: false, onboardingWelcomeSeen: false, displayName: null, age: null, consents: { current } } });
        assert.equal(url, '/api/consents', `Unexpected request: ${url}`);
        assert.equal(request.method(), 'POST');
        assert.deepEqual(request.postDataJSON(), EXPECTED);
        writes.push(url);
        if (!failed && scenario === 'fails') { failed = true; return route.fulfill({ status: 500, json: {} }); }
        if (!failed && scenario === 'unconfirmed-save') { failed = true; return route.fulfill({ json: { ok: true, current: false, version: legal.version } }); }
        if (!failed && scenario === 'stale-version') { failed = true; return route.fulfill({ status: 409, json: { error: 'outdated_version', version: 'newer' } }); }
        current = true;
        if (!failed && scenario === 'lost-response') { failed = true; return route.abort('failed'); }
        return route.fulfill({ json: { ok: true, current: true, version: legal.version } });
      });
      await page.goto(`${base}`);
      await page.getByRole('button', { name: 'Начать мою историю 360°', exact: true }).click();
      const next = page.getByRole('button', { name: 'Продолжить', exact: true });
      const boxes = page.getByRole('checkbox');
      assert(await next.isDisabled());
      await boxes.nth(0).check(); assert(await next.isDisabled());
      await boxes.nth(0).uncheck(); await boxes.nth(1).check(); assert(await next.isDisabled());
      await boxes.nth(0).check(); assert(await next.isEnabled());
      assert.equal(writes.length, 0);
      await next.click();
      if (['fails', 'lost-response', 'unconfirmed-save', 'stale-version'].includes(scenario)) {
        await page.getByRole('alert').waitFor();
        assert(await page.getByRole('heading', { name: 'Ваши данные — под вашим контролем' }).isVisible());
        assert(await boxes.nth(0).isChecked()); assert(await boxes.nth(1).isChecked());
        assert.equal(writes.length, 1);
        await next.click();
      }
      await page.getByRole('heading', { name: 'Немного о вас', exact: true }).waitFor();
      assert(current);
      assert.equal(writes.length, ['fails', 'lost-response', 'unconfirmed-save', 'stale-version'].includes(scenario) ? 2 : 1);
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`PASS ${scenario}: ${writes.length} consent writes`);
      await page.close();
    }

    // Hold the request open and dispatch same-tick clicks to exercise the ref lock.
    {
      const page = await browser.newPage(); let release; let started;
      const waiting = new Promise(resolve => { started = resolve; });
      const barrier = new Promise(resolve => { release = resolve; });
      const writes = [];
      await page.route('**/api/**', async route => { if (new URL(route.request().url()).pathname === '/api/events') { (globalThis.analyticsBatches ||= []).push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); } 
        const url = new URL(route.request().url()).pathname;
        if (url === '/api/me') return route.fulfill({ json: { onboardingVersion: 'v2', onboardingAnketaCompleted: false, onboardingWelcomeSeen: false, displayName: null, age: null } });
        writes.push(url); started(); await barrier;
        return route.fulfill({ json: { ok: true, current: true, version: legal.version } });
      });
      await page.goto(`${base}`);
      await page.getByRole('button', { name: 'Начать мою историю 360°' }).click();
      await page.getByRole('checkbox').nth(0).check(); await page.getByRole('checkbox').nth(1).check();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).evaluate(button => { button.click(); button.click(); button.click(); });
      await waiting;
      assert(await page.getByRole('button', { name: 'Сохраняем…', exact: true }).isDisabled());
      assert(await page.getByRole('checkbox').nth(0).isDisabled()); assert(await page.getByRole('checkbox').nth(1).isDisabled());
      assert(await page.getByRole('button', { name: '← Назад', exact: true }).isDisabled());
      release();
      await page.getByRole('heading', { name: 'Немного о вас', exact: true }).waitFor();
      assert.deepEqual(writes, ['/api/consents']);
      console.log('PASS repeated clicks: one consent write; checkboxes and back locked');
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.route('**/api/**', route => { if (new URL(route.request().url()).pathname === '/api/events') { (globalThis.analyticsBatches ||= []).push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); }  if (new URL(route.request().url()).pathname === '/api/me') return route.fulfill({ json: { onboardingVersion: 'v2', onboardingAnketaCompleted: false, onboardingWelcomeSeen: false } }); throw new Error(`Unexpected API request while reading documents: ${route.request().url()}`); });
      await page.goto(`${base}`);
      await page.getByRole('button', { name: 'Начать мою историю 360°' }).click();
      for (const [key, title] of Object.entries(legal.documents).map(([k, d]) => [k, d.title])) {
        const link = page.getByRole('link', { name: title, exact: true });
        assert.equal(new URL(await link.getAttribute('href'), page.url()).pathname, `/checkin/${legal.documents[key].path}`);
        const popupPromise = page.waitForEvent('popup');
        await link.click();
        const doc = await popupPromise; await doc.waitForLoadState();
        assert.equal(await doc.locator('article').getAttribute('aria-label'), title);
        assert((await doc.locator('article').innerText()).includes('ПРОЕКТ ДЛЯ ЮРИДИЧЕСКОЙ ПРОВЕРКИ'));
        const original = await doc.getByRole('link', { name: 'Скачать исходный проект DOCX' }).getAttribute('href');
        const response = await doc.request.get(new URL(original, doc.url()).href);
        assert(response.ok()); assert((await response.body()).subarray(0, 2).equals(Buffer.from('PK')));
        await doc.close();
        assert(!(await page.getByRole('checkbox').nth(0).isChecked()));
        assert(!(await page.getByRole('checkbox').nth(1).isChecked()));
      }
      console.log('PASS 3 legal links from the single source open the published drafts; links do not toggle consent');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
