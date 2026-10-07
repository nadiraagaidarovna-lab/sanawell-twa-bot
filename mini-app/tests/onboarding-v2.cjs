// New 7-screen onboarding against Vite dev: ONBOARDING_TEST_BASE_URL=http://127.0.0.1:5175/checkin/
// All /api requests are intercepted by an in-memory fake server. No real backend or user data.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const legal = require('../src/lib/legal-documents.json');
const base = process.env.ONBOARDING_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';
const ORDER = ['nutrition', 'movement', 'sleep', 'menopause360', 'emotions', 'environment'];
const WELCOME = 'Вы не одна. И разбираться во всём самой не нужно';

function fakeServer(page, record, writes, fail = {}) {
  return page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/events') return route.fulfill({ json: { ok: true } });
    if (request.method() === 'GET') {
      if (path === '/api/me') return route.fulfill({ json: record });
      if (path === '/api/checkin') return route.fulfill({ json: { checkin: null } });
      if (path === '/api/checkin/history') return route.fulfill({ json: { history: [] } });
      if (path === '/api/checkin/weekly-report') return route.fulfill({ json: { recommendations: [], doctorNudge: { show: false, text: null } } });
      if (path === '/api/today-action') return route.fulfill({ json: { needsTopic: true, priority: null, options: [] } });
      if (path === '/api/checkin/summary') return route.fulfill({ json: { daysCount: 0, lastCheckinDate: null } });
      throw new Error(`Unexpected read ${path}`);
    }
    const body = request.postDataJSON();
    writes.push({ path, body });
    if (fail[path] > 0) { fail[path]--; return route.fulfill({ status: 503, json: {} }); }
    switch (path) {
      case '/api/consents': record.consents = { current: true }; return route.fulfill({ json: { ok: true, current: true, version: legal.version } });
      case '/api/anketa/name': record.displayName = body.displayName; return route.fulfill({ json: { ok: true } });
      case '/api/anketa/topics': {
        record.focusTopics = ORDER.filter(t => body.topics.includes(t));
        if (record.focusPriority !== 'unsure' && !record.focusTopics.includes(record.focusPriority)) record.focusPriority = null;
        return route.fulfill({ json: { ok: true, focusTopics: record.focusTopics, focusPriority: record.focusPriority } });
      }
      case '/api/anketa/priority':
        if (body.priority !== 'unsure' && !record.focusTopics.includes(body.priority)) return route.fulfill({ status: 409, json: {} });
        record.focusPriority = body.priority; return route.fulfill({ json: { ok: true } });
      case '/api/anketa/progress':
        record.onboardingReachedStep = Math.max(record.onboardingReachedStep || 0, body.step); return route.fulfill({ json: { ok: true } });
      case '/api/onboarding-welcome-seen': record.onboardingWelcomeSeen = true; return route.fulfill({ json: { ok: true } });
      case '/api/anketa/complete': record.onboardingAnketaCompleted = true; return route.fulfill({ json: { ok: true } });
      default: throw new Error(`Unexpected write ${path}`);
    }
  });
}
const fresh = over => ({ onboardingVersion: 'v2', onboardingWelcomeSeen: false, onboardingAnketaCompleted: false,
  consents: { current: false }, displayName: null, focusTopics: [], focusPriority: null, age: 52, cycleSituation: 'unsure', mhtStatus: 'no', ...over });
const heading = (page, name) => page.getByRole('heading', { name, exact: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.ONBOARDING_TEST_BROWSER || 'msedge' });
  try {
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = []; const writes = [];
      page.on('pageerror', e => errors.push(e.message));
      const record = fresh();
      await fakeServer(page, record, writes);
      await page.goto(base);
      await heading(page, WELCOME).waitFor();
      for (const line of ['SanaWell мягко сопровождает вас через изменения после 40.', 'Поймёте себя', 'Сон, приливы, настроение — что с чем связано.',
        'Получите ясные ответы', 'На понятном языке, без страшилок.', 'Будете знать, что делать', 'Простые шаги и подсказки, когда обратиться к врачу.',
        'Несколько вопросов помогут настроить приложение под вас. Правильных ответов нет.']) {
        assert.equal(await page.getByText(line, { exact: true }).count(), 1, line);
      }
      assert(await page.getByRole('button', { name: 'Начать знакомство', exact: true }).isVisible());
      assert.equal(await page.getByText('1/7').count(), 1);
      await page.getByRole('button', { name: 'Начать знакомство', exact: true }).click();
      await page.getByRole('checkbox').nth(0).check(); await page.getByRole('checkbox').nth(1).check();
      const next = page.getByRole('button', { name: 'Продолжить', exact: true });
      await next.click();
      await heading(page, 'Как к вам обращаться?').waitFor();
      await page.getByLabel('Имя').fill('Тестовая'); await next.click();
      await heading(page, 'Что для вас сейчас важно?').waitFor();
      assert(await next.isDisabled(), 'at least one topic required');
      assert.equal(await page.getByRole('checkbox').count(), 6);
      const topicsText = await page.locator('.sw-onboarding-options').innerText();
      assert(topicsText.includes('Менопауза 360°') && !/интимн/i.test(topicsText), 'short topic name');
      await page.locator('input[value=emotions]').check(); await page.locator('input[value=sleep]').check(); await page.locator('input[value=environment]').check();
      await next.click();
      await heading(page, 'Что для вас главное сейчас?').waitFor();
      // 'Окружение и смысл' is selectable as a topic but not offered as the main priority.
      assert.deepEqual(await page.getByRole('radio').evaluateAll(r => r.map(x => x.value)), ['sleep', 'emotions', 'unsure']);
      assert(await next.isDisabled());
      await page.locator('input[value=emotions]').check(); await next.click();
      await heading(page, 'Проверьте ответы').waitFor();
      const review = await page.locator('.sw-onboarding-review').innerText();
      assert(review.includes('Тестовая') && review.includes('Сон и восстановление, Эмоциональное здоровье, Окружение и смысл') && review.includes('Эмоциональное здоровье'));
      // Edit topics from the review: removing the priority topic asks for the priority again.
      await page.getByRole('button', { name: 'Изменить: Темы', exact: true }).click();
      await heading(page, 'Что для вас сейчас важно?').waitFor();
      assert(await page.locator('input[value=sleep]').isChecked() && await page.locator('input[value=emotions]').isChecked());
      await page.locator('input[value=emotions]').uncheck(); await page.locator('input[value=environment]').uncheck(); await next.click();
      await heading(page, 'Что для вас главное сейчас?').waitFor();
      await page.locator('input[value=unsure]').check(); await next.click();
      await heading(page, 'Проверьте ответы').waitFor();
      // Edit name from the review returns to the review.
      await page.getByRole('button', { name: 'Изменить: Имя', exact: true }).click();
      await page.getByLabel('Имя').fill('Тест'); await next.click();
      await heading(page, 'Проверьте ответы').waitFor();
      assert((await page.locator('.sw-onboarding-review').innerText()).includes('Тест'));
      await page.getByRole('button', { name: 'Всё верно', exact: true }).click();
      await heading(page, 'Ваша стартовая карта').waitFor();
      const map = await page.locator('.sw-onboarding-content').innerText();
      assert(map.includes('Пока не выбран') && map.includes('Сон и восстановление') && map.includes('Техники для засыпания'));
      assert(!map.includes('На главной'), 'no technical labels');
      assert(!/диагноз|лечение|у вас перименопауза|у вас менопауза/i.test(map));
      assert.equal(await page.getByText('Эмоциональное здоровье').count(), 0); // removed topic not on the map
      assert.equal(writes.filter(w => w.path.startsWith('/api/anketa/') && !['/api/anketa/complete', '/api/anketa/progress'].includes(w.path)).length, 6);
      assert.equal(record.onboardingReachedStep, 7);
      assert(!writes.some(w => ['/api/anketa/age', '/api/anketa/cycle-situation', '/api/anketa/mht-status'].includes(w.path)));
      await page.getByRole('button', { name: 'Отметить самочувствие →', exact: true }).click();
      await page.locator('.checkin-fields').waitFor(); // existing check-in, unchanged
      assert(record.onboardingAnketaCompleted && record.onboardingWelcomeSeen);
      assert.deepEqual([record.displayName, record.focusTopics, record.focusPriority, record.age, record.cycleSituation], ['Тест', ['sleep'], 'unsure', 52, 'unsure']);
      await page.goto(base); await page.locator('.sw-greeting').waitFor(); // completed: no onboarding again
      assert.equal(await page.locator('.sw-onboarding').count(), 0);
      assert.deepEqual(errors, []);
      console.log('PASS full path: 7 screens, review edits, start map from topics/priority, completion, no repeat');
      await page.close();
    }
    for (const [name, over, expected] of [
      ['no consent', {}, WELCOME],
      ['consent only', { consents: { current: true } }, 'Как к вам обращаться?'],
      ['topics saved', { consents: { current: true }, focusTopics: ['sleep'] }, 'Что для вас главное сейчас?'],
      ['name skipped, reached topics', { consents: { current: true }, onboardingReachedStep: 4 }, 'Что для вас сейчас важно?'],
      ['all saved', { consents: { current: true }, focusTopics: ['sleep'], focusPriority: 'sleep', displayName: 'Тест', onboardingReachedStep: 6 }, 'Проверьте ответы'],
      ['reached the map', { consents: { current: true }, focusTopics: ['sleep'], focusPriority: 'sleep', onboardingReachedStep: 7 }, 'Ваша стартовая карта'],
      ['reached map but priority missing', { consents: { current: true }, focusTopics: ['sleep'], onboardingReachedStep: 7 }, 'Что для вас главное сейчас?'],
    ]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const writes = [];
      await fakeServer(page, fresh(over), writes);
      await page.goto(base); await heading(page, expected).waitFor();
      assert.deepEqual(writes, []);
      console.log(`PASS resume after close (${name}) -> ${expected}`);
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const writes = [];
      const record = fresh({ consents: { current: true } });
      await fakeServer(page, record, writes, { '/api/anketa/topics': 1, '/api/anketa/name': 0 });
      await page.goto(base); await heading(page, 'Как к вам обращаться?').waitFor();
      await page.getByLabel('Имя').fill(''); await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await heading(page, 'Что для вас сейчас важно?').waitFor();
      assert(!writes.some(w => w.path === '/api/anketa/name'), 'blank optional name is not written');
      assert.equal(record.onboardingReachedStep, 4, 'skipping the name is remembered');
      await page.locator('input[value=nutrition]').check();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await page.getByRole('alert').waitFor();
      assert(await heading(page, 'Что для вас сейчас важно?').isVisible());
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await heading(page, 'Что для вас главное сейчас?').waitFor();
      assert.deepEqual(record.focusTopics, ['nutrition']);
      console.log('PASS optional blank name, visible save error and retry');
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const writes = [];
      const record = fresh({ consents: { current: true }, onboardingWelcomeSeen: true, onboardingAnketaCompleted: true,
        displayName: 'Тест', focusTopics: ['sleep', 'emotions'], focusPriority: 'sleep', reminderOptIn: false, habitsReminderOptIn: false });
      await fakeServer(page, record, writes);
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      await page.getByRole('button', { name: 'Профиль', exact: true }).click();
      await page.getByText('Сон и восстановление, Эмоциональное здоровье').waitFor();
      await page.getByRole('button', { name: 'Изменить темы', exact: true }).click();
      await heading(page, 'Что для вас сейчас важно?').waitFor();
      assert.equal(await page.locator('.sw-onboarding-progress').count(), 0);
      await page.locator('input[value=movement]').check();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await heading(page, 'Что для вас главное сейчас?').waitFor();
      await page.locator('input[value=movement]').check();
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await page.getByText('Движение и сила, Сон и восстановление, Эмоциональное здоровье').waitFor();
      await page.getByText('Главный приоритет: Движение и сила').waitFor();
      assert(record.onboardingAnketaCompleted, 'completion untouched');
      console.log('PASS edit topics and priority from the cabinet');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
