// GuideScreen.tsx — папка «Гид» (Срез Д, Промпт 4, ТЗ 4.4.1). Плейсхолдер «Готовим, скоро»
// из Промпта 1/5 заменён на реальный контент: Тема 0 «Этапы жизни после 40» (раздел 5.3.1
// ТЗ) через уже готовый, но до этого нигде не подключённый SwipeCards.tsx. Затем — Тема
// «Суставы и плечи» (те же свайп-карточки, следом за Темой 0; у карточки «что можно делать»
// есть ссылка в «Тело» → «Плечи»). Остальные темы раздела 5.3 (гормоны/сон/эмоции/память/
// питание/активность/урогенитальное здоровье) и тема «Симптомы по этапам» (5.3.2) — ещё не
// написаны, это не весь «Гид» целиком.
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useNavigation } from '../lib/useNavigation';
import SwipeCards from '../components/SwipeCards';
import BottomNav from '../components/BottomNav';
import { getGuideCards } from '../content/guide';
import { consumeGuideTarget } from '../lib/guideTarget';
import { setBodyTarget } from '../lib/bodyTarget';

interface MeResponse {
  menopausePath: 'natural' | 'surgical' | 'oncological' | null;
}

type ViewState =
  | { state: 'loading' }
  | { state: 'loaded'; menopausePath: MeResponse['menopausePath'] }
  | { state: 'error'; message: string };

export default function GuideScreen() {
  const { push } = useNavigation();
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

  const guideCards = getGuideCards(view.state === 'loaded' ? view.menopausePath : null);
  // Абзацы тела карточки разделены пустой строкой (у карточек Темы 0 абзац один).
  const cards: string[][] = guideCards.map((card) => [card.title, ...card.body.split('\n\n')]);
  // Ссылка-переход в «Тело» под текстом карточки (у тем «Суставы и плечи» — «Смотри
  // упражнения для плеч»): кладёт цель в bodyTarget и открывает экран «Тело».
  const footers = guideCards.map((card) =>
    card.link ? (
      <button
        type="button"
        className="guide-link"
        onClick={() => {
          setBodyTarget(card.link!.bodyTarget);
          push('body');
        }}
      >
        {card.link.label}
      </button>
    ) : null
  );

  // Если Гид открыли ссылкой из «Самочувствия» («И почитайте в Гиде: Мозг») — после того как
  // известен menopausePath (набор карточек, а с ним и индекс нужной, зависит от пути)
  // листаем сразу на карточку с этим тегом. Пока идёт загрузка — ничего не забираем, чтобы
  // тег не потерялся; без ссылки (обычный вход) тега нет, Гид открывается с первой карточки.
  useEffect(() => {
    if (view.state === 'loading') return undefined;
    const tag = consumeGuideTarget();
    if (!tag) return undefined;
    const targetIndex = getGuideCards(view.state === 'loaded' ? view.menopausePath : null).findIndex(
      (card) => card.tag === tag
    );
    if (targetIndex >= 0) setIndex(targetIndex);
    return undefined;
  }, [view]);

  return (
    <main className="screen v2-screen v2-accent-c3">
      <p className="eyebrow">SanaWell</p>
      <h1>Гид</h1>

      <SwipeCards cards={cards} index={index} onIndexChange={setIndex} footers={footers} />

      <BottomNav active="guide" />
    </main>
  );
}
