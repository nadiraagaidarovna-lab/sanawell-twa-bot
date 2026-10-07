// Home wellness cards open the matching content only. Vite dev: SECTIONS_TEST_BASE_URL=http://127.0.0.1:5175/checkin/
// All /api requests are intercepted; protocols come from the real backend/src/protocols.js content.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { getAllProtocols } = require(path.resolve(__dirname, '../../backend/src/protocols.js'));
const base = process.env.SECTIONS_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';
const protocols = getAllProtocols();
const titles = (module) => protocols[module].map((p) => p.title);
const ALL = Object.values(protocols).flat().map((p) => p.title);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.SECTIONS_TEST_BROWSER || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let writesPaused = false;
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/events') return route.fulfill({ json: { ok: true } });
      if (p === '/api/me') return route.fulfill({ json: { onboardingVersion: 'v2', onboardingWelcomeSeen: true, onboardingAnketaCompleted: true,
        consents: { current: true }, displayName: 'Тест', menopausePath: null, symptomChecklist: null, writesPaused } });
      if (p === '/api/protocols') return route.fulfill({ json: { protocols } });
      if (p === '/api/checkin') return route.fulfill({ json: { checkin: null } });
      if (p === '/api/checkin/history') return route.fulfill({ json: { history: [] } });
      if (p === '/api/checkin/weekly-report') return route.fulfill({ json: { recommendations: [], doctorNudge: { show: false, text: null } } });
      if (p === '/api/checkin/summary') return route.fulfill({ json: { daysCount: 0, lastCheckinDate: null } });
      throw new Error(`Unexpected request ${p}`);
    });
    const home = async () => { await page.goto(base); await page.locator('.sw-greeting').waitFor(); };
    const card = (label) => page.getByRole('button', { name: label, exact: true });
    const shownTitles = () => page.locator('.protocol-title').allInnerTexts();

    await home();
    const grid = await page.locator('.sw-wellness-grid').innerText();
    assert(!/интимн/i.test(grid), 'no promise of intimate-hygiene materials on Home');
    assert.equal(await page.getByRole('button', { name: 'Менопауза 360°', exact: true }).count(), 1);

    for (const [label, heading, module] of [
      ['Питание и обмен веществ', 'Питание', 'nutrition'],
      ['Сон и восстановление', 'Сон', 'sleep'],
      ['Эмоциональное здоровье', 'Эмоции', 'mood'],
    ]) {
      await home(); await card(label).click();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await page.locator('.protocol-title').first().waitFor();
      assert.deepEqual(await shownTitles(), titles(module), `${label}: only ${module}`);
      assert.equal(await page.locator('.module-heading').count(), 0, 'no other module headings');
      await page.getByRole('button', { name: 'Все техники самопомощи', exact: true }).click();
      await page.getByRole('heading', { name: 'Все техники самопомощи', exact: true }).waitFor();
      assert.deepEqual((await shownTitles()).sort(), [...ALL].sort(), 'expanding shows everything, clearly labelled');
      console.log(`PASS ${label} -> ${heading}: only ${titles(module).length} ${module} cards first`);
    }

    await home(); await card('Окружение и смысл').click();
    await page.getByRole('heading', { name: 'Окружение и смысл', exact: true }).waitFor();
    assert(await page.getByText('Материалы по этой теме ещё готовятся.', { exact: true }).isVisible());
    assert.equal(await page.locator('.protocol-card, .swipe-card').count(), 0, 'no foreign materials');
    console.log('PASS Окружение -> honest placeholder');

    await home(); await card('Менопауза 360°').click();
    await page.locator('.swipe-card').first().waitFor();
    console.log('PASS Менопауза 360° -> Гид');

    await home(); await card('Движение и сила').click();
    await page.locator('.ex-section, details').first().waitFor();
    console.log('PASS Движение -> Тело (unchanged)');

    // The target is one-shot: entering «Мой план поддержки» another way shows all techniques.
    await home(); await card('Питание и обмен веществ').click();
    await page.getByRole('heading', { name: 'Питание', exact: true }).waitFor();
    await home();
    await page.locator('.sw-action-btn').click(); // «Сегодня для вас» -> Открыть
    await page.getByRole('heading', { name: 'Все техники самопомощи', exact: true }).waitFor();
    await page.locator('.protocol-title').first().waitFor();
    assert.equal((await shownTitles()).length, ALL.length);
    console.log('PASS target is one-shot: other entry shows all techniques');
    assert.equal(await page.locator('.sw-writes-paused').count(), 0, 'no banner in normal mode');
    writesPaused = true; await home();
    await page.getByText('Сохранение новых данных временно приостановлено. Просматривать сохранённое можно как обычно.').waitFor();
    writesPaused = false; await home();
    assert.equal(await page.locator('.sw-writes-paused').count(), 0, 'banner gone after return to normal');
    console.log('PASS read-only banner shown only while writes are paused');
    assert.deepEqual(errors, []);
    console.log('PASS no errors');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
