// Map → action → concrete material → «Попробовала / Пока нет» → end of today. Vite dev, /api faked
// in memory with the REAL selection logic (backend/src/dailyAction.js). No backend or user data.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { buildTodayAction, ACTIONABLE_TOPICS } = require(path.resolve(__dirname, '../../backend/src/dailyAction.js'));
const { getAllProtocols } = require(path.resolve(__dirname, '../../backend/src/protocols.js'));
const base = process.env.TODAY_TEST_BASE_URL || 'http://127.0.0.1:5175/checkin/';

function fake(page, record, log) {
  return page.route('**/api/**', (route) => {
    const req = route.request(), p = new URL(req.url()).pathname;
    record.marks = record.marks || {};
    const now = () => buildTodayAction(record.focusPriority, record.row, record.marks);
    if (p === '/api/events') return route.fulfill({ json: { ok: true } });
    if (req.method() === 'POST') log.push(p);
    switch (p) {
      case '/api/me': return route.fulfill({ json: { onboardingVersion: 'v2', onboardingWelcomeSeen: true, onboardingAnketaCompleted: true,
        consents: { current: true }, displayName: 'Тест', focusPriority: record.focusPriority, menopausePath: null } });
      case '/api/today-action':
        if (req.method() === 'GET') return route.fulfill({ json: now() });
        break;
      case '/api/today-action/topic': {
        const { topic } = req.postDataJSON();
        assert(ACTIONABLE_TOPICS.includes(topic));
        record.row = { today_topic: topic === record.focusPriority ? null : topic }; // marks are kept
        return route.fulfill({ json: now() });
      }
      case '/api/today-action/status': {
        const { materialId, status } = req.postDataJSON();
        const a = now();
        if (a.needsTopic || a.material.id !== materialId) return route.fulfill({ status: 409, json: {} });
        record.marks[materialId] = status;
        return route.fulfill({ json: now() });
      }
      case '/api/protocols': return route.fulfill({ json: { protocols: getAllProtocols() } });
      case '/api/checkin':
        if (req.method() === 'GET') return route.fulfill({ json: { checkin: record.checkin || null } });
        { const d = req.postDataJSON();
          record.checkin = { sleepScore: d.sleep, moodScore: d.mood, memoryScore: d.memory, energyScore: null, hot_flashes: null, comment: null, canCorrect: true };
          return route.fulfill({ json: { ok: true, checkin: record.checkin } }); }
      case '/api/checkin/history': return route.fulfill({ json: { history: [] } });
      case '/api/checkin/weekly-report': return route.fulfill({ json: { recommendations: [], doctorNudge: { show: false, text: null } } });
      case '/api/checkin/summary': return route.fulfill({ json: { daysCount: 1, lastCheckinDate: null } });
    }
    throw new Error(`Unexpected ${req.method()} ${p}`);
  });
}
const panel = (page) => page.locator('.sw-today').first();

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.TODAY_TEST_BROWSER || 'msedge' });
  try {
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const log = []; const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const record = { focusPriority: 'sleep', row: null };
      const expected = buildTodayAction('sleep', null).material;
      await fake(page, record, log);
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      await panel(page).getByText(expected.title, { exact: true }).waitFor();
      assert((await panel(page).innerText()).includes('Вы выбрали эту тему при знакомстве'));
      // A low check-in today does not change the route.
      await page.getByRole('button', { name: 'Отметить самочувствие', exact: true }).click();
      for (const name of ['Сон', 'Настроение', 'Ясность / концентрация']) await page.getByRole('group', { name, exact: true }).getByRole('button', { name: '1 из 10', exact: true }).click();
      await page.getByRole('button', { name: 'Сохранить отметку', exact: true }).click();
      await page.getByRole('heading', { name: 'Моя Карта самочувствия 360°' }).waitFor();
      await panel(page).getByText(expected.title, { exact: true }).waitFor();
      assert((await panel(page).innerText()).includes('Вы выбрали эту тему при знакомстве'), 'map: same action, same reason');
      // Open the concrete material: only that technique; opening is not «done».
      await panel(page).getByRole('button', { name: 'Открыть', exact: true }).click();
      await page.getByRole('heading', { name: expected.title, exact: true }).waitFor();
      assert.deepEqual(await page.locator('.protocol-title').allInnerTexts(), [expected.title]);
      assert.deepEqual(record.marks, {}, 'opening the material records nothing');
      assert(!log.includes('/api/today-action/status'));
      await page.getByRole('button', { name: 'Попробовала', exact: true }).click();
      await page.getByText('Отлично. На сегодня всё 🤍 Возвращайтесь завтра — отметьте самочувствие.').waitFor();
      assert.equal(record.marks[expected.id], 'tried');
      await page.getByRole('button', { name: 'На главную', exact: true }).click();
      await page.locator('.sw-greeting').waitFor();
      await panel(page).getByText('Отмечено: попробовала. На сегодня всё 🤍 Возвращайтесь завтра.').waitFor();
      assert.deepEqual(errors, []);
      console.log('PASS map -> action (by priority, not today\'s score) -> one technique -> «Попробовала» -> end of today');
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const log = [];
      const record = { focusPriority: 'sleep', row: null };
      await fake(page, record, log);
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      // Mark the priority material first: switching the topic must not carry that mark over.
      await panel(page).getByRole('button', { name: 'Открыть', exact: true }).click();
      await page.getByRole('button', { name: 'Попробовала', exact: true }).click();
      await page.getByRole('button', { name: 'На главную', exact: true }).click();
      await panel(page).getByText('Отмечено: попробовала', { exact: false }).waitFor();
      await panel(page).getByRole('button', { name: 'Сегодня хочу другую тему', exact: true }).click();
      assert.equal(await panel(page).getByRole('button', { name: 'Сон и восстановление', exact: true }).count(), 0, 'current topic not offered');
      assert.equal(await panel(page).getByText('Окружение и смысл').count(), 0, 'no topic without materials');
      await panel(page).getByRole('button', { name: 'Эмоциональное здоровье', exact: true }).click();
      await panel(page).getByText('Вы выбрали эту тему на сегодня', { exact: true }).waitFor();
      assert.equal(record.focusPriority, 'sleep', 'main priority unchanged');
      const mood = buildTodayAction('sleep', { today_topic: 'emotions' }).material;
      await panel(page).getByText(mood.title, { exact: true }).waitFor();
      assert.equal(record.marks[mood.id], undefined, 'new topic starts unmarked');
      assert.equal(await panel(page).getByText('Отмечено', { exact: false }).count(), 0, 'old mark not shown on the new material');
      await panel(page).getByRole('button', { name: 'Открыть', exact: true }).click();
      await page.getByRole('heading', { name: mood.title, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Пока нет', exact: true }).click();
      await page.getByText('Хорошо, можно вернуться к этому позже. На сегодня всё 🤍').waitFor();
      assert.equal(record.marks[mood.id], 'not_yet');
      // Back to the main topic the same day: its «Попробовала» is still there.
      await page.getByRole('button', { name: 'На главную', exact: true }).click();
      await panel(page).getByRole('button', { name: 'Сегодня хочу другую тему', exact: true }).click();
      await panel(page).getByRole('button', { name: 'Сон и восстановление', exact: true }).click();
      await panel(page).getByText('Отмечено: попробовала', { exact: false }).waitFor();
      assert.equal(record.marks[buildTodayAction('sleep', null).material.id], 'tried');
      console.log('PASS «Сегодня хочу другую тему»: today only, priority kept; «Пока нет» recorded');
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const log = [];
      const record = { focusPriority: 'unsure', row: null };
      await fake(page, record, log);
      await page.goto(base); await page.locator('.sw-greeting').waitFor();
      await panel(page).getByText('Выберите тему на сегодня', { exact: false }).waitFor();
      await panel(page).getByRole('button', { name: 'Менопауза 360°', exact: true }).click();
      await panel(page).getByText('Этапы жизни после 40', { exact: true }).waitFor();
      await panel(page).getByRole('button', { name: 'Открыть', exact: true }).click();
      await page.locator('.swipe-card').first().waitFor();
      await page.getByRole('button', { name: 'Попробовала', exact: true }).click();
      await page.getByText('Отлично. На сегодня всё', { exact: false }).waitFor();
      assert.equal(record.focusPriority, 'unsure');
      console.log('PASS no priority -> choose a topic for today -> Guide material -> mark');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
