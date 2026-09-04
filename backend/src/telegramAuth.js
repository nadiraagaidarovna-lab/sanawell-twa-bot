// telegramAuth.js — проверка подлинности Telegram WebApp initData.
// Реализация по официальной спецификации:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
const crypto = require('crypto');

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // сутки — initData старше считаем протухшей

function buildSecretKey(botToken) {
  return crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
}

/**
 * Проверяет initData, присланную из Telegram Web App.
 * @param {string} initData — строка вида "query_id=...&user=...&auth_date=...&hash=..."
 * @param {string} botToken
 * @returns {{ ok: boolean, reason?: string, user?: object, authDate?: number }}
 */
function verifyInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') {
    return { ok: false, reason: 'missing_init_data' };
  }
  if (!botToken) {
    return { ok: false, reason: 'server_misconfigured' };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = buildSecretKey(botToken);
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // hash от клиента может быть произвольной (в том числе некорректной по длине/формату)
  // строкой — сравниваем безопасно, без риска бросить исключение на "грязном" входе.
  const computedBuf = Buffer.from(computedHash, 'hex');
  const providedBuf = Buffer.from(hash, 'hex');
  const validHash =
    providedBuf.length === computedBuf.length &&
    crypto.timingSafeEqual(computedBuf, providedBuf);
  if (!validHash) return { ok: false, reason: 'bad_signature' };

  const authDate = Number(params.get('auth_date') || '0');
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (!authDate || ageSeconds > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: 'stale_init_data' };
  }

  let user = null;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    // если поле повреждено — не блокируем, просто не будет user-объекта
  }

  return { ok: true, user, authDate };
}

/**
 * Express middleware: ожидает initData в заголовке X-Telegram-Init-Data.
 * При успехе кладёт req.telegramUser = { id, ... } и req.telegramId = String(id).
 */
function requireTelegramAuth(botToken) {
  return (req, res, next) => {
    const initData = req.header('X-Telegram-Init-Data');
    const result = verifyInitData(initData, botToken);

    if (!result.ok) {
      return res.status(401).json({ error: 'unauthorized', reason: result.reason });
    }

    if (!result.user || !result.user.id) {
      return res.status(401).json({ error: 'unauthorized', reason: 'missing_user' });
    }

    req.telegramUser = result.user;
    req.telegramId = String(result.user.id);
    next();
  };
}

module.exports = { verifyInitData, requireTelegramAuth, buildSecretKey };
