// Скрипт для ручной проверки: генерирует валидную initData тем же алгоритмом,
// что использует настоящий Telegram, и бьёт по локальному серверу.
// Использование: node backend/test/verify-auth.js
require('dotenv').config();
const crypto = require('crypto');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;

function buildInitData(user) {
  const params = {
    query_id: 'AAHtest',
    user: JSON.stringify(user),
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return new URLSearchParams({ ...params, hash }).toString();
}

function request(path, method, initData, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const initData = buildInitData({ id: 987654321, first_name: 'Test' });

  const meBefore = await request('/api/me', 'GET', initData);
  console.log('GET /api/me (новый пользователь) ->', meBefore.status, meBefore.body);

  const lang = await request('/api/language', 'POST', initData, { language: 'kk' });
  console.log('POST /api/language (kk) ->', lang.status, lang.body);

  const meAfterLang = await request('/api/me', 'GET', initData);
  console.log('GET /api/me (после выбора языка, до согласия) ->', meAfterLang.status, meAfterLang.body);

  const consent = await request('/api/consent', 'POST', initData, { reminderOptIn: true });
  console.log('POST /api/consent (reminderOptIn=true) ->', consent.status, consent.body);

  const meAfterConsent = await request('/api/me', 'GET', initData);
  console.log('GET /api/me (после согласия) ->', meAfterConsent.status, meAfterConsent.body);

  const track = await request('/api/track', 'POST', initData, { module: 'mood', value: 'anxious' });
  console.log('POST /api/track ->', track.status, track.body.slice(0, 200), '...');

  const progress = await request('/api/progress?days=14', 'GET', initData);
  console.log('GET /api/progress ->', progress.status, progress.body);

  const reminderOff = await request('/api/reminder-opt-in', 'POST', initData, { optIn: false });
  console.log('POST /api/reminder-opt-in (optIn=false) ->', reminderOff.status, reminderOff.body);

  const meAfterReminderOff = await request('/api/me', 'GET', initData);
  console.log('GET /api/me (после отключения напоминаний) ->', meAfterReminderOff.status, meAfterReminderOff.body);

  const safetyOk = await request('/api/safety-check', 'POST', initData, { text: 'всё нормально, просто устала' });
  console.log('POST /api/safety-check (безопасный текст) ->', safetyOk.status, safetyOk.body);

  const safetyRisk = await request('/api/safety-check', 'POST', initData, { text: 'не хочу жить' });
  console.log('POST /api/safety-check (маркер риска, ru) ->', safetyRisk.status, safetyRisk.body);

  const safetyRiskKk = await request('/api/safety-check', 'POST', initData, { text: 'өмір сүргім келмейді' });
  console.log('POST /api/safety-check (маркер риска, kk, при языке интерфейса kk) ->', safetyRiskKk.status, safetyRiskKk.body);

  const badAuth = await request('/api/track', 'POST', 'hash=deadbeef&auth_date=1', undefined);
  console.log('POST /api/track с поддельной initData ->', badAuth.status, badAuth.body);
})();
