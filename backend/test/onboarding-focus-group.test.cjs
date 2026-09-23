// No database connection, migrations or real Telegram credentials.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const filename = path.resolve(__dirname, '../src/routes.js');
const nativeRequire = createRequire(filename);
const { requireTelegramAuth } = require('../src/telegramAuth');
const token = 'focus-group-isolated-test-token';
function signed(id) {
  const params = new URLSearchParams({ user: JSON.stringify({ id }), auth_date: String(Math.floor(Date.now() / 1000)) });
  const data = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(data).digest('hex'));
  return params.toString();
}
test('focus-group eligibility is off by default, exact-match and authenticated; no writes', async () => {
  const original = process.env.ONBOARDING_TESTER_IDS;
  try {
    for (const configuration of ['', '*', '101, 202, invalid, *, 0']) {
      process.env.ONBOARDING_TESTER_IDS = configuration;
      const db = { getUser: async () => ({ onboarding_anketa_completed: true, onboarding_welcome_seen: true, medical_disclaimer_consent_at: 'existing', data_storage_consent_at: 'existing', menopause_path: null }) };
      const module = { exports: {} };
      vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })(
        name => name === './db' ? db : nativeRequire(name), module, module.exports);
      const app = nativeRequire('express')();
      app.use('/api', module.exports.buildRouter({ requireAuth: requireTelegramAuth(token) }));
      const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
      try {
        const url = `http://127.0.0.1:${server.address().port}/api/me`;
        assert.equal((await fetch(url)).status, 401);
        assert.equal((await fetch(url, { headers: { 'X-Telegram-Init-Data': 'user=101&hash=invalid' } })).status, 401);
        for (const id of [101, 202, 10, 1010, 999]) {
          const response = await fetch(url + '?telegramId=101&newOnboardingTester=true', { headers: { 'X-Telegram-Init-Data': signed(id) } });
          assert.equal(response.status, 200);
          const me = await response.json();
          assert.equal(me.newOnboardingTester, configuration.startsWith('101,') && [101, 202].includes(id));
          assert.equal(me.onboardingAnketaCompleted, true);
          assert.equal(me.onboardingWelcomeSeen, true);
          assert.equal(me.medicalDisclaimerConsented, true);
          assert.equal(me.dataStorageConsented, true);
          assert.equal(me.menopausePath, null);
          assert.equal(me.onboarded, false); // Eligibility must not depend on this old flag.
          assert.equal(JSON.stringify(me).includes(configuration), configuration === '');
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
    }
  } finally {
    if (original === undefined) delete process.env.ONBOARDING_TESTER_IDS;
    else process.env.ONBOARDING_TESTER_IDS = original;
  }
});
