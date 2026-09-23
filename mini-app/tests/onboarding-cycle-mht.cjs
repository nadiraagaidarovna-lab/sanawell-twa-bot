// Vite development preview; all API calls intercepted, no real user records.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ONBOARDING_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';
const cycleKeys = ['regular','changing','no_period_12m','post_surgery','treatment_affected','other','unsure'];
const mhtKeys = ['current','no','considering','previous','prefer_not_to_say'];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const scenario of ['new','existing','cycle-fails','mht-fails','lost-response','restore-after-lost-response','unconfirmed','load-fails','invalid-load','duplicate-cycle','duplicate-mht','reopen']) {
      const page = await browser.newPage(); const writes = [], errors = [];
      let reads = 0, failed = false, release, started;
      const barrier = new Promise(r => { release = r; }), waiting = new Promise(r => { started = r; });
      const record = { medicalDisclaimerConsented: true, dataStorageConsented: true, displayName: 'Надира', age: 49, cycleSituation: scenario === 'existing' ? 'post_surgery' : null, mhtStatus: scenario === 'existing' ? 'previous' : null };
      if (scenario === 'restore-after-lost-response') record.mhtStatus = 'no';
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        assert('x-telegram-init-data' in route.request().headers());
        if (path === '/api/me') {
          reads++;
          if (reads === 3 && scenario === 'load-fails') return route.fulfill({ status: 503, json: {} });
          if (reads === 3 && scenario === 'invalid-load') return route.fulfill({ json: { ...record, cycleSituation: 'absent_12_months' } });
          return route.fulfill({ json: record });
        }
        assert(['/api/anketa/cycle-situation','/api/anketa/mht-status'].includes(path), path);
        const field = path.endsWith('/cycle-situation') ? 'cycleSituation' : 'mhtStatus';
        const data = route.request().postDataJSON(); assert.deepEqual(Object.keys(data), [field]);
        writes.push({ path, data });
        if ((scenario === 'duplicate-cycle' && field === 'cycleSituation') || (scenario === 'duplicate-mht' && field === 'mhtStatus')) { started(); await barrier; }
        if (!failed && ((scenario === 'cycle-fails' && field === 'cycleSituation') || (['mht-fails','lost-response','restore-after-lost-response','unconfirmed'].includes(scenario) && field === 'mhtStatus'))) {
          failed = true;
          if (['lost-response','restore-after-lost-response'].includes(scenario)) { record[field] = data[field]; return route.abort(); }
          return route.fulfill({ status: scenario === 'unconfirmed' ? 200 : 503, json: {} });
        }
        record[field] = data[field]; return route.fulfill({ json: { ok: true } });
      });
      const next = page.getByRole('button', { name: 'Продолжить', exact: true });
      async function openCycle() {
        await page.goto(`${base}?onboarding-preview`);
        await page.getByRole('button', { name: 'Начать мою историю 360°' }).click();
        await page.getByRole('checkbox').nth(0).check(); await page.getByRole('checkbox').nth(1).check(); await next.click();
        await page.waitForFunction(() => !document.querySelector('#onboarding-name')?.disabled);
        await next.click(); await page.getByRole('heading', { name: 'Расскажите немного о вашем цикле' }).waitFor();
      }
      async function advance(field) {
        if (scenario === 'duplicate-' + field) {
          await next.evaluate(b => { b.click(); b.click(); b.click(); }); await waiting;
          assert(await page.getByRole('radio').first().isDisabled());
          assert(await page.getByRole('button', { name: '← Назад' }).isDisabled());
          assert(await page.getByRole('button', { name: 'Сохраняем…', exact: true }).isDisabled()); release();
        } else await next.click();
        if ((scenario === 'cycle-fails' && field === 'cycle') || (['mht-fails','lost-response','restore-after-lost-response','unconfirmed'].includes(scenario) && field === 'mht')) {
          await page.getByRole('alert').waitFor();
          assert.equal(await page.getByRole('radio').count(), field === 'cycle' ? 7 : 5);
          assert.equal(await page.locator('input[type=radio]:checked').count(), 1);
          if (scenario === 'restore-after-lost-response') await page.locator('input[value=no]').check();
          await next.click();
        }
      }
      await openCycle();
      if (['load-fails','invalid-load'].includes(scenario)) {
        await page.getByRole('alert').waitFor(); assert(await next.isDisabled());
        assert(await page.getByRole('radio').first().isDisabled()); assert.equal(writes.length, 0);
        await page.getByRole('button', { name: 'Повторить загрузку' }).click();
      }
      await page.waitForFunction(() => !document.querySelector('fieldset')?.disabled);
      assert.deepEqual(await page.getByRole('radio').evaluateAll(inputs => inputs.map(i => i.value)), cycleKeys);
      if (scenario === 'existing') assert(await page.locator('input[value=post_surgery]').isChecked());
      else {
        assert.equal(await page.locator('input[type=radio]:checked').count(), 0); assert(await next.isDisabled());
        await page.locator('input[value=unsure]').check();
      }
      await advance('cycle');
      await page.getByRole('heading', { name: 'Принимаете ли вы сейчас МГТ/ГЗТ?' }).waitFor();
      assert.deepEqual(await page.getByRole('radio').evaluateAll(inputs => inputs.map(i => i.value)), mhtKeys);
      if (scenario === 'existing') assert(await page.locator('input[value=previous]').isChecked());
      else {
        if (scenario === 'restore-after-lost-response') assert(await page.locator('input[value=no]').isChecked());
        else { assert.equal(await page.locator('input[type=radio]:checked').count(), 0); assert(await next.isDisabled()); assert.equal(record.mhtStatus, null); }
        assert.equal(record.cycleSituation, 'unsure');
        if (scenario === 'reopen') {
          await openCycle(); await page.waitForFunction(() => !document.querySelector('fieldset')?.disabled);
          assert(await page.locator('input[value=unsure]').isChecked()); await next.click();
          await page.getByRole('heading', { name: 'Принимаете ли вы сейчас МГТ/ГЗТ?' }).waitFor();
        }
        await page.locator('input[value=prefer_not_to_say]').check();
      }
      await advance('mht');
      await page.getByRole('heading', { name: 'Начнём вашу историю 360°' }).waitFor();
      assert.equal(writes.filter(w => w.path.endsWith('/cycle-situation')).length, scenario === 'existing' ? 0 : scenario === 'cycle-fails' ? 2 : 1);
      assert.equal(writes.filter(w => w.path.endsWith('/mht-status')).length, scenario === 'existing' ? 0 : ['mht-fails','lost-response','restore-after-lost-response','unconfirmed'].includes(scenario) ? 2 : 1);
      if (scenario === 'restore-after-lost-response') assert.equal(record.mhtStatus, 'no');
      await openCycle(); await page.waitForFunction(() => !document.querySelector('fieldset')?.disabled);
      assert(await page.locator(`input[value=${record.cycleSituation}]`).isChecked()); await next.click();
      assert(await page.locator(`input[value=${record.mhtStatus}]`).isChecked());
      assert.deepEqual(errors, []); console.log(`PASS ${scenario}`); await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
