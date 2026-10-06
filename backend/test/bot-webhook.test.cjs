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

function loadBot() {
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
    setWebHook(url, options) { this.webhook = { url, options }; return Promise.resolve(true); }
  }
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })(
    name => name === 'node-telegram-bot-api' ? FakeBot : name === './db' ? {} : name === 'dotenv' ? { config() {} } : nativeRequire(name),
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
