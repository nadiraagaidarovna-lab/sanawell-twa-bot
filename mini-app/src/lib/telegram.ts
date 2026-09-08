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
