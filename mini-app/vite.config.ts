import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Проксируем /api на уже работающий Express-бэкенд (см. ../backend/src/server.js),
    // а не разрешаем CORS отдельно: в проде (Срез 6) сборка mini-app будет отдаваться
    // тем же Express-сервером с того же origin, что и API — proxy в dev воспроизводит
    // такое же поведение без лишней конфигурации на бэкенде.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
