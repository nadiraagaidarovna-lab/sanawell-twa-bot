// Run against Vite dev: CONSENT_TEST_BASE_URL=http://127.0.0.1:5175/checkin/
// Use installed Playwright, or point PLAYWRIGHT_MODULE at an existing installation.
// All /api requests are intercepted. These tests never contact a real backend.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CONSENT_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CONSENT_TEST_BROWSER || 'msedge' });
  try {
    for (const scenario of ['success', 'first-fails', 'second-fails', 'lost-response', 'status-fails', 'invalid-status', 'unconfirmed-save', 'existing', 'partial-existing']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const records = { medicalDisclaimerConsented: scenario === 'existing' || scenario === 'partial-existing', dataStorageConsented: scenario === 'existing' };
      const writes = []; const errors = []; let failed = false; let statusReads = 0;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', async route => {
        const request = route.request(); const path = new URL(request.url()).pathname;
        assert('x-telegram-init-data' in request.headers());
        if (path === '/api/me') {
          statusReads++;
          if (scenario === 'status-fails' && !failed) {
            failed = true; return route.fulfill({ status: 503, json: {} });
          }
          if (scenario === 'invalid-status' && !failed) {
            failed = true; return route.fulfill({ json: {} });
          }
          return route.fulfill({ json: records });
        }
        assert.equal(request.method(), 'POST');
        assert.deepEqual(request.postDataJSON(), { consented: true });
        const key = path === '/api/consent/medical-disclaimer' ? 'medicalDisclaimerConsented'
          : path === '/api/consent/data-storage' ? 'dataStorageConsented' : null;
        assert(key, `Unexpected write: ${path}`);
        writes.push(path);
        if (!failed && ((scenario === 'first-fails' && key === 'medicalDisclaimerConsented') || (scenario === 'second-fails' && key === 'dataStorageConsented'))) {
          failed = true; return route.fulfill({ status: 500, json: {} });
        }
        if (!failed && scenario === 'unconfirmed-save') {
          failed = true; return route.fulfill({ json: { ok: false } });
        }
        records[key] = true;
        if (!failed && scenario === 'lost-response') {
          failed = true; return route.abort('failed');
        }
        return route.fulfill({ json: { ok: true } });
      });
      await page.goto(`${base}?onboarding-preview`);
      await page.getByRole('button', { name: 'Начать мою историю 360°', exact: true }).click();
      const next = page.getByRole('button', { name: 'Продолжить', exact: true });
      const boxes = page.getByRole('checkbox');
      assert(await next.isDisabled());
      await boxes.nth(0).check(); assert(await next.isDisabled());
      await boxes.nth(0).uncheck(); await boxes.nth(1).check(); assert(await next.isDisabled());
      await boxes.nth(0).check(); assert(await next.isEnabled());
      assert.equal(writes.length, 0);
      await next.click();
      if (['first-fails', 'second-fails', 'lost-response', 'status-fails', 'invalid-status', 'unconfirmed-save'].includes(scenario)) {
        await page.getByRole('alert').waitFor();
        assert(await page.getByRole('heading', { name: 'Ваши данные — под вашим контролем' }).isVisible());
        assert(await boxes.nth(0).isChecked()); assert(await boxes.nth(1).isChecked());
        if (scenario === 'first-fails') assert.equal(writes.length, 1);
        if (scenario === 'second-fails') assert.equal(writes.length, 2);
        if (scenario === 'status-fails' || scenario === 'invalid-status') assert.equal(writes.length, 0);
        await next.click();
      }
      await page.getByRole('heading', { name: 'Немного о вас', exact: true }).waitFor();
      assert(records.medicalDisclaimerConsented && records.dataStorageConsented);
      if (scenario === 'existing') assert.deepEqual(writes, []);
      if (['partial-existing'].includes(scenario)) assert.deepEqual(writes, ['/api/consent/data-storage']);
      if (['second-fails', 'lost-response'].includes(scenario)) assert.equal(writes.filter(path => path.endsWith('/medical-disclaimer')).length, 1);
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`PASS ${scenario}: ${statusReads} status reads, ${writes.length} writes`);
      await page.close();
    }

    // Hold a request open and dispatch same-tick clicks to exercise the ref lock.
    {
      const page = await browser.newPage(); let release; let started;
      const waiting = new Promise(resolve => { started = resolve; });
      const barrier = new Promise(resolve => { release = resolve; });
      let reads = 0; const writes = [];
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/me') {
          reads++; started(); await barrier;
          return route.fulfill({ json: { medicalDisclaimerConsented: false, dataStorageConsented: false } });
        }
        writes.push(path); return route.fulfill({ json: { ok: true } });
      });
      await page.goto(`${base}?onboarding-preview`);
      await page.getByRole('button', { name: 'Начать мою историю 360°' }).click();
      await page.getByRole('checkbox').nth(0).check(); await page.getByRole('checkbox').nth(1).check();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).evaluate(button => { button.click(); button.click(); button.click(); });
      await waiting;
      assert(await page.getByRole('button', { name: 'Сохраняем…', exact: true }).isDisabled());
      assert(await page.getByRole('checkbox').nth(0).isDisabled()); assert(await page.getByRole('checkbox').nth(1).isDisabled());
      assert(await page.getByRole('button', { name: '← Назад', exact: true }).isDisabled());
      release();
      await page.getByRole('heading', { name: 'Немного о вас', exact: true }).waitFor();
      assert.equal(reads, 1); assert.deepEqual(writes, ['/api/consent/medical-disclaimer', '/api/consent/data-storage']);
      console.log('PASS repeated clicks: one save sequence; checkboxes and back locked');
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.route('**/api/**', route => { throw new Error(`Unexpected API request while reading documents: ${route.request().url()}`); });
      await page.goto(`${base}?onboarding-preview`);
      await page.getByRole('button', { name: 'Начать мою историю 360°' }).click();
      for (const title of ['Условия использования', 'Политика конфиденциальности', 'Согласие на сбор и обработку персональных данных']) {
        const popupPromise = page.waitForEvent('popup');
        await page.getByRole('link', { name: title, exact: true }).click();
        const doc = await popupPromise; await doc.waitForLoadState();
        assert.equal(await doc.locator('article').getAttribute('aria-label'), title);
        assert((await doc.locator('article').innerText()).includes('ПРОЕКТ ДЛЯ ЮРИДИЧЕСКОЙ ПРОВЕРКИ'));
        assert((await doc.locator('article p').count()) > 20);
        assert.equal(await doc.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await doc.locator('body').evaluate(el => getComputedStyle(el).fontSize), '18px');
        const original = await doc.getByRole('link', { name: 'Скачать исходный проект DOCX' }).getAttribute('href');
        const response = await doc.request.get(new URL(original, doc.url()).href);
        assert(response.ok()); assert((await response.body()).subarray(0, 2).equals(Buffer.from('PK')));
        await doc.close();
        assert(!(await page.getByRole('checkbox').nth(0).isChecked()));
        assert(!(await page.getByRole('checkbox').nth(1).isChecked()));
      }
      console.log('PASS all 3 readable legal links, draft marks, original downloads; links do not toggle consent');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
