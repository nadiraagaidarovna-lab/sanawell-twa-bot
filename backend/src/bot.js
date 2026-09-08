// bot.js — Telegram-бот: /start + кнопка запуска Web App, и ежедневный планировщик
// мягких напоминаний (ТЗ, Модуль 4.3). Экспортирует startBot(), который server.js
// вызывает в том же процессе, что и Express — так бот и API работают с ОДНИМ и тем же
// SQLite-файлом (два отдельных сервиса на Render не делят диск между собой, поэтому
// раздельный процесс бота на проде не увидел бы согласие/язык/подписку на напоминания,
// сохранённые через API). Можно запускать и отдельно (`npm run bot`) — например, для
// локальной отладки без поднятия всего сервера.
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const TEXT = {
  ru: {
    welcome: [
      'Здравствуйте 🤍',
      '',
      'Если сейчас всё это ощущается как «схожу с ума» — это не так.',
      'Бессонница, раздражительность, туман в голове — естественная часть гормональной ' +
        'перестройки, а не ваша личная слабость.',
      '',
      'Здесь никто вас не увидит и не осудит. Просто нажмите кнопку ниже — и разберёмся вместе, шаг за шагом.',
    ].join('\n'),
    open: 'Открыть',
    checkin: 'Ежедневный чек-ин',
    reminder: 'Как прошёл день? Если хочется — загляните и отметьте, как вы 🤍',
    disable: 'Отключить',
    disabled: 'Хорошо, больше не будем писать. Бот всегда открыт, когда захотите вернуться сами.',
  },
  kk: {
    welcome: [
      'Сәлеметсіз бе 🤍',
      '',
      'Егер қазір бәрі «жынданып бара жатырмын» деген сезім тудырса — бұл олай емес.',
      'Ұйқысыздық, тітіркену, бас айналуы — гормоналды қайта құрылымдаудың табиғи бөлігі, ' +
        'сіздің әлсіздігіңіз емес.',
      '',
      'Мұнда сізді ешкім көрмейді және айыптамайды. Төмендегі батырманы басыңыз — бірге, қадам-қадаммен шешеміз.',
    ].join('\n'),
    open: 'Ашу',
    checkin: 'Күнделікті чек-ин',
    reminder: 'Күніңіз қалай өтті? Қаласаңыз, кіріп, қалай екеніңізді белгілеңіз 🤍',
    disable: 'Өшіру',
    disabled: 'Жақсы, енді жазбаймыз. Бот сіз өзіңіз қайта оралғыңыз келгенде әрқашан ашық.',
  },
};

function todayAlmaty() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
}

function currentAlmatyHour() {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Almaty', hour: 'numeric', hour12: false }).format(
      new Date()
    )
  );
}

// Возвращает запущенный экземпляр бота (или null, если BOT_TOKEN/WEBAPP_URL не заданы —
// это допустимо для локального запуска сервера без бота, например при отладке фронтенда).
function startBot({
  botToken = process.env.BOT_TOKEN,
  webAppUrl = process.env.WEBAPP_URL,
  botMode = process.env.BOT_MODE || 'polling',
  reminderHour = Number(process.env.REMINDER_HOUR || 19),
  reminderCheckIntervalMs = 5 * 60 * 1000,
} = {}) {
  if (!botToken) {
    console.warn('BOT_TOKEN не задан — бот не запущен (API и фронтенд продолжат работать).');
    return null;
  }
  if (!webAppUrl) {
    console.warn('WEBAPP_URL не задан — бот не запущен (API и фронтенд продолжат работать).');
    return null;
  }

  const bot = new TelegramBot(botToken, { polling: botMode === 'polling' });

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    // Язык ещё не выбран на этом этапе (выбор — первый экран самого Web App, ТЗ 5.1),
    // поэтому приветствие двуязычное.
    const text = `${TEXT.ru.welcome}\n\n— — —\n\n${TEXT.kk.welcome}`;
    bot.sendMessage(chatId, text, {
      reply_markup: {
        // Старый 3-кнопочный трекер и новый Mini App с чек-ином — рядом, второй не
        // заменяет первый (ТЗ раздел 4: "дополняет уже существующий трекер, не заменяет").
        inline_keyboard: [
          [{ text: `${TEXT.ru.open} / ${TEXT.kk.open}`, web_app: { url: webAppUrl } }],
          [
            {
              text: `${TEXT.ru.checkin} / ${TEXT.kk.checkin}`,
              web_app: { url: `${webAppUrl}/checkin` },
            },
          ],
        ],
      },
    });
  });

  // Кнопка "Отключить" прямо в сообщении с напоминанием — работает в один клик,
  // без дополнительных вопросов и без повторных предложений включить обратно (ТЗ 4.3, раздел 2).
  bot.on('callback_query', async (query) => {
    if (query.data !== 'disable_reminder') return;

    const telegramId = String(query.from.id);
    db.setReminderOptIn(telegramId, false);

    const user = db.getUser(telegramId);
    const lang = user && user.language === 'kk' ? 'kk' : 'ru';

    try {
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText(TEXT[lang].disabled, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      });
    } catch (e) {
      console.warn('Не удалось обработать отключение напоминания:', e.message);
    }
  });

  async function sendDailyReminders() {
    if (currentAlmatyHour() !== reminderHour) return;

    const today = todayAlmaty();
    const dueUsers = db.getUsersDueForReminder(today);

    for (const user of dueUsers) {
      const lang = user.language === 'kk' ? 'kk' : 'ru';
      try {
        await bot.sendMessage(user.telegram_id, TEXT[lang].reminder, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: TEXT[lang].open, web_app: { url: webAppUrl } },
                { text: TEXT[lang].disable, callback_data: 'disable_reminder' },
              ],
            ],
          },
        });
      } catch (e) {
        console.warn(`Не удалось отправить напоминание ${user.telegram_id}:`, e.message);
      }
      // marking sent regardless of delivery success avoids retry storms against a user
      // who has blocked the bot; a single missed evening is an acceptable trade-off in MVP.
      db.markReminderSent(user.telegram_id, today);
    }
  }

  const timer = setInterval(() => {
    sendDailyReminders().catch((e) => console.error('Ошибка планировщика напоминаний:', e));
  }, reminderCheckIntervalMs);
  // На платформах, где хочется дать процессу завершиться самостоятельно (не Render/prod),
  // таймер не должен держать event loop живым сам по себе.
  if (typeof timer.unref === 'function') timer.unref();

  console.log(
    `Бот запущен в режиме "${botMode}". Web App URL: ${webAppUrl}. ` +
      `Напоминания: ~${reminderHour}:00 по Алматы, проверка каждые ${
        reminderCheckIntervalMs / 60000
      } мин.`
  );

  return bot;
}

if (require.main === module) {
  // Отдельный запуск: `npm run bot` — например, локально, если не хочется поднимать весь
  // Express-сервер. На проде используйте `npm start` (server.js запускает бота сам).
  const bot = startBot();
  if (!bot) process.exit(1);
}

module.exports = { startBot };
