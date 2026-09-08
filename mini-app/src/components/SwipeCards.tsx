// SwipeCards.tsx — горизонтальный свайп-карусель через нативный scroll-snap (не JS-жест-
// библиотека — на WebView Telegram нативный скролл даёт более плавный и предсказуемый
// свайп, чем самодельная логика перетаскивания). Управляется как контролируемый компонент
// (index/onIndexChange), чтобы MainButton («Далее») мог листать карточки программно,
// синхронно с ручным свайпом пользователя. Переиспользуется — тот же паттерн нужен для
// тизера "Этапы жизни после 40" (ТЗ 5.3.1/6.2, следующий срез) и полной версии темы 0.
import { useEffect, useRef } from 'react';

interface SwipeCardsProps {
  /** Каждая карточка — массив абзацев (рендерятся отдельными <p>). */
  cards: string[][];
  index: number;
  onIndexChange: (index: number) => void;
}

export default function SwipeCards({ cards, index, onIndexChange }: SwipeCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // true, пока идёт скролл, который вызвали МЫ САМИ (клик по MainButton/точке) — чтобы
  // не принять его хвост за ручной свайп и не откатить index обратно. Ловили именно
  // это как баг: debounce по паузе между scroll-событиями срабатывал на промежуточной
  // позиции ещё не доехавшего smooth-scroll и откатывал карточку назад.
  const programmatic = useRef(false);

  // Внешняя смена index (клик по точке или по MainButton) — прокручиваем к карточке.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;

    programmatic.current = true;
    // Фоллбэк-снятие guard'а — на случай, если браузер не поддержит scrollend
    // (см. обработчик ниже) и событие не придёт вовсе; с запасом по времени
    // относительно обычной длительности smooth-скролла на одну карточку.
    const fallback = window.setTimeout(() => {
      programmatic.current = false;
    }, 700);

    // scrollTo(), не прямое присваивание scrollLeft — со scroll-snap-type:mandatory
    // на контейнере браузер может проигнорировать/откатить голое scrollLeft-присваивание
    // как не «настоящий» скролл-жест; scrollTo() — штатный, snap-совместимый способ.
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });

    return () => window.clearTimeout(fallback);
  }, [index]);

  // 'scrollend' — единый сигнал о том, что скролл реально остановился, для обоих
  // случаев (программный и ручной свайп); debounce на scroll-событиях по времени
  // ненадёжен, т.к. браузер не гарантирует их частоту во время анимации.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const handleScrollEnd = () => {
      if (programmatic.current) {
        programmatic.current = false;
        return; // это был наш собственный скролл к уже известному index — ничего не считаем
      }
      if (el.clientWidth === 0) return;
      const settledIndex = Math.round(el.scrollLeft / el.clientWidth);
      if (settledIndex !== index && settledIndex >= 0 && settledIndex < cards.length) {
        onIndexChange(settledIndex);
      }
    };

    el.addEventListener('scrollend', handleScrollEnd);
    return () => el.removeEventListener('scrollend', handleScrollEnd);
  }, [index, cards.length, onIndexChange]);

  return (
    <div>
      <div className="swipe-cards" ref={containerRef}>
        {cards.map((paragraphs, i) => (
          <div className="swipe-card" key={i}>
            {paragraphs.map((p, j) => (
              <p className="body-text" key={j}>
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>

      <div className="swipe-dots">
        {cards.map((_, i) => (
          <span key={i} className={`swipe-dot${i === index ? ' active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
