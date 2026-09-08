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
  isTMA,
  miniAppReady,
  mockTelegramEnv,
  mountMiniAppSync,
  mountThemeParamsSync,
  mountViewport,
  retrieveRawInitData,
} from '@telegram-apps/sdk';

// Тестовые launch params для разработки вне Telegram. hash заведомо невалиден для реальной
// HMAC-проверки на бэкенде (см. backend/src/telegramAuth.js в соседнем sanawell-twa-bot/backend) —
// это ожидаемо: локальный браузер вне Telegram не должен проходить настоящую аутентификацию,
// это будет отдельно проверено внутри самого Telegram на Срезе 2.
function mockEnvForLocalDev() {
  const initDataRaw = new URLSearchParams([
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

  if (!isTMA()) {
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
