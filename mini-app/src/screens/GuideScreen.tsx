// GuideScreen.tsx — папка «Гид» (Срез Д, Промпт 4, ТЗ 4.4.1). Плейсхолдер «Готовим, скоро»
// из Промпта 1/5 заменён на реальный контент: Тема 0 «Этапы жизни после 40» (раздел 5.3.1
// ТЗ) через уже готовый, но до этого нигде не подключённый SwipeCards.tsx. Остальные темы
// раздела 5.3 (гормоны/сон/эмоции/память/питание/активность/урогенитальное здоровье) и
// тема «Симптомы по этапам» (5.3.2, требует review гинеколога) — ещё не написаны, это
// только Тема 0, не весь «Гид» целиком.
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import SwipeCards from '../components/SwipeCards';
import BottomNav from '../components/BottomNav';
import { getTheme0Cards } from '../content/guide';

interface MeResponse {
  menopausePath: 'natural' | 'surgical' | 'oncological' | null;
}

type ViewState =
  | { state: 'loading' }
  | { state: 'loaded'; menopausePath: MeResponse['menopausePath'] }
  | { state: 'error'; message: string };

export default function GuideScreen() {
  const [view, setView] = useState<ViewState>({ state: 'loading' });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    apiFetch<MeResponse>('/me')
      .then((me) => {
        if (cancelled) return;
        setView({ state: 'loaded', menopausePath: me.menopausePath });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Сеть недоступна — не блокируем экран, просто показываем безопасный дефолт
        // (тот же 'natural', что уже принят для анкеты при "затрудняюсь ответить").
        const message = e instanceof ApiError ? `${e.status}: ${e.message}` : 'Сеть недоступна';
        setView({ state: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const theme0Cards = getTheme0Cards(view.state === 'loaded' ? view.menopausePath : null);
  const cards: string[][] = theme0Cards.map((card) => [card.title, card.body]);

  return (
    <main className="screen v2-screen v2-accent-c3">
      <p className="eyebrow">SanaWell</p>
      <h1>Гид</h1>

      <SwipeCards cards={cards} index={index} onIndexChange={setIndex} />

      <BottomNav active="guide" />
    </main>
  );
}
