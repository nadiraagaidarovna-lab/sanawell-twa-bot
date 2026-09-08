// WelcomeScreen.tsx — Срез 1 Этапа 2: приветственный экран онбординга (ТЗ 6.2, шаг 1 /
// 6.2.1). Чистый контент/UI — вопрос о пути менопаузы, реальный выбор языка интерфейса
// и согласия добавят следующие срезы; чек-ин (HomeScreen/CheckinScreen) не тронут.
//
// Переключатель ru/kk здесь — временная возможность ПРОСМОТРЕТЬ оба варианта утверждённого
// текста, не полноценный выбор языка интерфейса (тот — отдельный шаг 3 в ТЗ 6.2, будущий
// срез с сохранением на бэкенде). Ничего не персистится.
import { useState } from 'react';
import SwipeCards from '../components/SwipeCards';
import { useMainButton } from '../lib/useMainButton';
import { useNavigation } from '../lib/useNavigation';
import { WELCOME_CARDS, type Lang } from '../content/welcomeScreen';

const MAIN_BUTTON_TEXT: Record<Lang, { next: string; start: string }> = {
  ru: { next: 'Далее', start: 'Начнём' },
  kk: { next: 'Келесі', start: 'Бастайық' },
};

export default function WelcomeScreen() {
  const { push } = useNavigation();
  const [lang, setLang] = useState<Lang>('ru');
  const [cardIndex, setCardIndex] = useState(0);

  const cards = WELCOME_CARDS[lang];
  const isLastCard = cardIndex === cards.length - 1;

  const handleLangChange = (next: Lang) => {
    setLang(next);
    setCardIndex(0);
  };

  useMainButton({
    text: isLastCard ? MAIN_BUTTON_TEXT[lang].start : MAIN_BUTTON_TEXT[lang].next,
    onClick: () => {
      if (isLastCard) {
        push('home');
      } else {
        setCardIndex((i) => i + 1);
      }
    },
  });

  return (
    <main className="screen">
      <div className="lang-toggle">
        <button
          type="button"
          className={lang === 'ru' ? 'active' : ''}
          onClick={() => handleLangChange('ru')}
        >
          RU
        </button>
        <button
          type="button"
          className={lang === 'kk' ? 'active' : ''}
          onClick={() => handleLangChange('kk')}
        >
          KK
        </button>
      </div>

      <p className="eyebrow">SanaWell</p>
      <SwipeCards cards={cards} index={cardIndex} onIndexChange={setCardIndex} />
    </main>
  );
}
