// api.ts — тонкая обёртка над fetch к существующему Express-бэкенду (sanawell-twa-bot/backend).
// Ни одного нового бизнес-роута здесь нет — только заголовок X-Telegram-Init-Data, который
// уже проверяет requireTelegramAuth в backend/src/telegramAuth.js (Срез 2: доказать, что связка
// React + @telegram-apps/sdk + существующий бэкенд реально проходит HMAC-проверку).
import { getInitDataRaw } from './telegram';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitDataRaw() ?? '',
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.reason ?? `HTTP ${res.status}`, res.status);
  }

  return res.json();
}
