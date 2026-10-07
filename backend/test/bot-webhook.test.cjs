// No network, no real Telegram or database: TelegramBot and db are replaced with stubs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const filename = path.resolve(__dirname, '../src/bot.js');
const nativeRequire = createRequire(filename);
const express = nativeRequire('express');

function loadBot(webhookFailures = 0, dbStub = {}) {
  const created = [];
  class FakeBot {
    constructor(token, options) { this.options = options; this.textHandlers = []; this.sent = []; this.webhook = null; created.push(this); }
    onText(re, fn) { this.textHandlers.push([re, fn]); }
    on() {}
    processUpdate(update) {
      const msg = update.message;
      for (const [re, fn] of this.textHandlers) if (msg && re.test(msg.text)) fn(msg);
    }
    sendMessage(chatId, text, options) { this.sent.push({ chatId, text, options }); return Promise.resolve({}); }
    setWebHook(url, options) {
      this.webhookCalls = (this.webhookCalls || 0) + 1;
      if (this.webhookCalls <= webhookFailures) return Promise.reject(new Error('ETELEGRAM: 409 Conflict'));
      this.webhook = { url, options }; return Promise.resolve(true);
    }
  }
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })(
    name => name === 'node-telegram-bot-api' ? FakeBot : name === './db' ? dbStub : name === 'dotenv' ? { config() {} } : nativeRequire(name),
    module, module.exports);
  return { ...module.exports, created };
}

async function serve(app) {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('webhook mode: secret-checked route, /start answered with the Open button to WEBAPP_URL/checkin', async () => {
  const { startBot, WEBHOOK_PATH, webhookSecret, created } = loadBot();
  const app = express(); app.use(express.json());
  const bot = startBot({ botToken: 'test-token', webAppUrl: 'https://staging.example', botMode: 'webhook', app });
  const { server, base } = await serve(app);
  try {
    assert.equal(created[0].options.polling, false);
    await new Promise(r => setImmediate(r));
    assert.equal(bot.webhook.url, `https://staging.example${WEBHOOK_PATH}`);
    assert.equal(bot.webhook.options.secret_token, webhookSecret('test-token'));
    assert.match(bot.webhook.options.secret_token, /^[A-Za-z0-9_-]{1,256}$/);
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 555 }, text: '/start' } };
    const post = (secret) => fetch(base + WEBHOOK_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}) }, body: JSON.stringify(update) });
    assert.equal((await post()).status, 401);
    assert.equal((await post('wrong')).status, 401);
    assert.equal(bot.sent.length, 0);
    assert.equal((await post(webhookSecret('test-token'))).status, 200);
    assert.equal(bot.sent.length, 1);
    const button = bot.sent[0].options.reply_markup.inline_keyboard[0][0];
    assert.equal(bot.sent[0].chatId, 555);
    assert.equal(button.web_app.url, 'https://staging.example/checkin');
    assert.match(button.text, /Открыть/);
  } finally { await new Promise(r => server.close(r)); }
});

test('polling mode (production default) is unchanged: no webhook route, no setWebHook', async () => {
  const { startBot, WEBHOOK_PATH, created } = loadBot();
  const app = express(); app.use(express.json());
  const bot = startBot({ botToken: 'test-token', webAppUrl: 'https://prod.example', botMode: 'polling', app });
  const { server, base } = await serve(app);
  try {
    assert.equal(created[0].options.polling, true);
    assert.equal(bot.webhook, null);
    assert.equal((await fetch(base + WEBHOOK_PATH, { method: 'POST' })).status, 404);
  } finally { await new Promise(r => server.close(r)); }
});

test('webhook mode retries setWebHook after 409 during a zero-downtime deploy', async () => {
  const { startBot } = loadBot(2);
  const app = express(); app.use(express.json());
  const bot = startBot({ botToken: 'test-token', webAppUrl: 'https://staging.example', botMode: 'webhook', app, webhookRetryDelayMs: 5 });
  for (let i = 0; i < 50 && !bot.webhook; i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(bot.webhookCalls, 3);
  assert.equal(bot.webhook.url, 'https://staging.example/telegram/webhook');
});

test('APP_WRITE_MODE=read_only pauses both reminder schedules; normal mode resumes them', async () => {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Almaty', hour: 'numeric', hour12: false }).format(new Date()));
  const run = async (mode) => {
    const calls = { daily: 0, habits: 0 };
    const db = { getUsersDueForReminder: async () => { calls.daily++; return []; }, getUsersDueForHabitsReminder: async () => { calls.habits++; return []; } };
    const saved = process.env.APP_WRITE_MODE;
    if (mode) process.env.APP_WRITE_MODE = mode; else delete process.env.APP_WRITE_MODE;
    try {
      const { startBot } = loadBot(0, db);
      startBot({ botToken: 'test-token', webAppUrl: 'https://x.example', botMode: 'webhook', app: express(), reminderHour: hour, habitsReminderHour: hour, reminderCheckIntervalMs: 10 });
      await new Promise(r => setTimeout(r, 80));
    } finally { if (saved === undefined) delete process.env.APP_WRITE_MODE; else process.env.APP_WRITE_MODE = saved; }
    return calls;
  };
  assert.deepEqual(await run('read_only'), { daily: 0, habits: 0 });
  const normal = await run(undefined);
  assert(normal.daily > 0 && normal.habits > 0, JSON.stringify(normal));
});
