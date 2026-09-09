require('dotenv').config();
const path = require('path');
const express = require('express');
const { requireTelegramAuth } = require('./telegramAuth');
const { buildRouter } = require('./routes');
const { startBot } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

app.use(express.json());

// Mini App (React + @telegram-apps/sdk, mini-app/) — единственный главный экран (Срез В
// консолидации, CLAUDE.md 4.3.1). Собранный index.html ссылается на /checkin/assets/...
// (см. mini-app/vite.config.ts: base: '/checkin/'), поэтому монтируем именно на этом
// префиксе — иначе ассеты не найдутся.
app.use('/checkin', express.static(path.join(__dirname, '..', '..', 'mini-app', 'dist')));

// Старый vanilla-трекер (frontend/) упразднён — редирект на случай уже открытых вкладок
// или закэшированных в клиенте Telegram ссылок на корень, чтобы женщина не видела
// пустую/сломанную страницу вместо главного экрана.
app.get('/', (_req, res) => res.redirect('/checkin/'));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Защитный сценарий (CLAUDE.md, раздел "Защитный сценарий") — выключен по умолчанию,
// пока список триггеров и текст кризисного сообщения не утвердит гинеколог-соучредитель.
// Включать явной переменной окружения, не хардкодом true.
const SAFETY_PROTOCOL_ENABLED = process.env.SAFETY_PROTOCOL_ENABLED === 'true';

app.use(
  '/api',
  buildRouter({ requireAuth: requireTelegramAuth(BOT_TOKEN), safetyProtocolEnabled: SAFETY_PROTOCOL_ENABLED })
);

// Единый обработчик ошибок: никогда не отдаём стектрейс/пути сервера наружу
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`SanaWell TWA backend запущен на порту ${PORT}`);
  if (!BOT_TOKEN) {
    console.warn('BOT_TOKEN не задан — проверка initData всегда будет возвращать 401. Заполните .env');
  }
  // Бот и планировщик напоминаний живут в том же процессе, что и API — оба используют
  // один и тот же SQLite-файл (см. README, раздел "Почему node:sqlite").
  startBot();
});
