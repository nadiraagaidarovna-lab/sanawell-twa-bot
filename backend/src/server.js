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

// Отдаём статику старого vanilla-трекера (frontend/) с корня — как и раньше, не трогаем.
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Новый Mini App (React + @telegram-apps/sdk, mini-app/) — на отдельном подпути, а не
// вместо старого трекера ("дополняет, не заменяет", ТЗ раздел 4). Собранный index.html
// ссылается на /checkin/assets/... (см. mini-app/vite.config.ts: base: '/checkin/'),
// поэтому именно на этом префиксе и монтируем — иначе ассеты не найдутся.
app.use('/checkin', express.static(path.join(__dirname, '..', '..', 'mini-app', 'dist')));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/api', buildRouter({ requireAuth: requireTelegramAuth(BOT_TOKEN) }));

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
