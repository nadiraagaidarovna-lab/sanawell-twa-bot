// telegram.ts — инициализация @telegram-apps/sdk: подписка на системную тему Telegram,
// раскрытие viewport, mini-app ready(), и вне Telegram (локальная разработка в браузере) —
// имитация окружения, чтобы SDK не падал и экраны можно было смотреть без реального клиента.
// См. ТЗ раздел 4.1/4.2: MainButton/BackButton/HapticFeedback/тема — через нативный SDK,
// initData HMAC-аутентификация на бэкенде (см. раздел 4.1) — без отдельного экрана логина.
import {
  bindMiniAppCssVars,
  bindThemeParamsCssVars,
  bindViewportCssVars,
  expandViewport,
  init as initSDK,
  miniAppReady,
  mockTelegramEnv,
  mountMiniAppSync,
  mountThemeParamsSync,
  mountViewport,
  retrieveRawInitData,
  setMiniAppBackgroundColor,
  setMiniAppHeaderColor,
  setMiniAppBottomBarColor,
} from '@telegram-apps/sdk';

// Тестовые launch params для разработки вне Telegram. По умолчанию hash заведомо невалиден
// для реальной HMAC-проверки на бэкенде (backend/src/telegramAuth.js) — этого достаточно
// для экранов, которые ничего не запрашивают у API (Срезы 0-1). Если задан
// VITE_MOCK_INIT_DATA (mini-app/.env.local, не коммитится) — это по-настоящему подписанная
// initData, сгенерированная реальным BOT_TOKEN, и запросы к бэкенду проходят HMAC-проверку
// по-настоящему, без необходимости открывать приложение внутри самого Telegram.
function mockEnvForLocalDev() {
  const signedInitData = import.meta.env.VITE_MOCK_INIT_DATA as string | undefined;

  const initDataRaw = signedInitData
    ? new URLSearchParams(signedInitData)
    : new URLSearchParams([
        ['user', JSON.stringify({ id: 1, first_name: 'Dev', language_code: 'ru' })],
        ['auth_date', String(Math.floor(Date.now() / 1000))],
        ['signature', 'mock-signature-local-dev-only'],
        ['hash', 'mock-hash-local-dev-only-not-a-real-signature'],
      ]);

  mockTelegramEnv({
    launchParams: {
      tgWebAppData: initDataRaw,
      tgWebAppThemeParams: {
        bg_color: '#FAF4EA',
        text_color: '#5E2A34',
        hint_color: '#8a7568',
        link_color: '#C1613F',
        button_color: '#C1613F',
        button_text_color: '#ffffff',
        secondary_bg_color: '#f1e6d8',
      },
      tgWebAppVersion: '8.0',
      tgWebAppPlatform: 'web',
    },
  });
}

let bootstrapped = false;

export function bootstrapTelegram(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  // import.meta.env.DEV, а не isTMA(): mockTelegramEnv сохраняет launch params в
  // sessionStorage, поэтому после первой перезагрузки isTMA() уже считает нас "в Telegram"
  // (хотя реального моста нет) и пропускает повторный мок — ложное срабатывание, актуальное
  // только для локальной разработки. DEV — флаг сборки Vite, в проде всегда false.
  if (import.meta.env.DEV) {
    mockEnvForLocalDev();
  }

  initSDK();

  mountMiniAppSync();
  bindMiniAppCssVars();
  miniAppReady();

  mountThemeParamsSync();
  bindThemeParamsCssVars();

  // Match native Mini App surfaces to SanaWell without changing Telegram theme data.
  if (setMiniAppBackgroundColor.isAvailable()) setMiniAppBackgroundColor('#fbf7f2');
  if (setMiniAppHeaderColor.isAvailable() && setMiniAppHeaderColor.supports.rgb()) {
    setMiniAppHeaderColor('#fbf7f2');
  }
  if (setMiniAppBottomBarColor.isAvailable()) setMiniAppBottomBarColor('#fbf7f2');

  mountViewport()
    .then(() => {
      bindViewportCssVars();
      expandViewport();
    })
    .catch(() => {
      // Старый клиент/окружение без поддержки viewport-методов — не критично для чек-ина.
    });
}

// Сырая строка initData для заголовка X-Telegram-Init-Data — тот же формат, что уже
// проверяет существующий backend/src/telegramAuth.js (HMAC-SHA256 по спецификации Telegram).
export function getInitDataRaw(): string | undefined {
  return retrieveRawInitData();
}

// Имя из Telegram (user.first_name) — для автозаполнения Шага 1 анкеты. Читаем ту же сырую
// initData, что уходит на бэкенд в X-Telegram-Init-Data (работает в реальном Telegram и в
// dev-моке), а не window.Telegram.WebApp: скрипт telegram-web-app.js в index.html не
// подключён, и SDK этот глобал не заполняет — там имя было бы всегда пустым.
export function getTelegramFirstName(): string | undefined {
  const firstName = readTelegramUser()?.first_name;
  return typeof firstName === 'string' && firstName.trim() ? firstName.trim() : undefined;
}

// Язык интерфейса Telegram (user.language_code) для автоопределения языка приложения
// (Срез О3, ТЗ 6.2.1). Тот же источник, что у getTelegramFirstName, и по той же причине:
// window.Telegram.WebApp.initDataUnsafe в реальном Telegram недоступен (см. выше), поэтому
// прежнее автоопределение по нему никогда не срабатывало и все получали русский. Поддержаны
// только 'ru' и 'kk'; всё остальное (включая 'en') и отсутствие поля — undefined, вызывающий
// подставляет 'ru' сам. Приоритет «сохранённый выбор > автодетект > ru» — на стороне экранов.
export function getTelegramLanguageCode(): 'ru' | 'kk' | undefined {
  const code = readTelegramUser()?.language_code;
  return code === 'ru' || code === 'kk' ? code : undefined;
}

// Объект user из initData (поле user — JSON внутри query-строки) или undefined, если
// initData нет/повреждена — вне Telegram и при любой ошибке разбора молча отдаёт undefined.
function readTelegramUser(): { first_name?: unknown; language_code?: unknown } | undefined {
  try {
    const raw = getInitDataRaw();
    if (!raw) return undefined;
    const user = new URLSearchParams(raw).get('user');
    return user ? (JSON.parse(user) as { first_name?: unknown; language_code?: unknown }) : undefined;
  } catch {
    return undefined;
  }
}
