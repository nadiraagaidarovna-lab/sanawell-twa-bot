// WellnessGrid.tsx — «6 сфер заботы о себе» (TASK 01, п.12/13 брифа). Список фиксирован
// продуктовым решением; каждый пункт ведёт на уже существующий функциональный экран —
// новых экранов/эндпоинтов не создаётся. Статусов по направлениям (Стабильно/Улучшается/
// Можно улучшить) здесь нет намеренно: у бэкенда сейчас есть данные только по трём
// измерениям чек-ина (сон/настроение/голова) и по использованию техник питания/силовых —
// для "Гормональное и интимное здоровье" и "Окружение и смысл" нет вообще никакого сигнала,
// поэтому статус для любой из шести карточек был бы отчасти выдуман. MVP-описания ниже —
// нейтральный статичный текст о содержании раздела, не оценка состояния.
// Иконки — простые обводки (тот же стиль, что уже в BottomNav.tsx), без градиентов и
// декоративных иллюстраций.
import type { ReactNode } from 'react';
import WellnessAreaCard from './WellnessAreaCard';
import type { ScreenId } from '../../lib/navigationContext';

function IconApple() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8c-3 0-5.5 2.3-5.5 6 0 3 2 6.5 4.2 6.5.9 0 1.3-.5 2.3-.5s1.4.5 2.3.5c1.9 0 3.7-2.8 4.2-5-2.7-1-2.9-4.6-.2-6.2-1-1.3-2.4-2-3.8-1.9-.9.1-1.6.5-2 .5s-1.2-.5-1.5-.5" />
      <path d="M12 8c0-1.8.8-3 2.2-3.5" />
    </svg>
  );
}

function IconDumbbell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6" />
      <path d="M7 12h10" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.6-9.3-8.9C1.2 8 2.6 5 5.7 5c1.9 0 3.3 1.1 4.3 2.6C11 6.1 12.4 5 14.3 5c3.1 0 4.5 3 3 6.1C19 15.4 12 20 12 20Z" />
    </svg>
  );
}

function IconWave() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12c2 0 2-4 4-4s2 4 4 4 2-4 4-4 2 4 4 4 2-4 4-4" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14Z" />
      <path d="M5 19c2-4 5-7 9-9" />
    </svg>
  );
}

interface WellnessArea {
  title: string;
  description: string;
  screen: ScreenId;
  icon: ReactNode;
}

// Назначения — прагматичный маппинг на уже существующие 5 точек входа (techniques/guide/
// body/progress), без удаления и без новых экранов. "Запись к врачу" сюда не входит —
// она вынесена отдельной второстепенной ссылкой ниже сетки (см. HomeScreen.tsx, п.13).
const AREAS: WellnessArea[] = [
  {
    title: 'Питание и обмен веществ',
    description: 'Базовые принципы и техники',
    screen: 'techniques',
    icon: <IconApple />,
  },
  {
    title: 'Движение и сила',
    description: 'Упражнения для тела 40+',
    screen: 'body',
    icon: <IconDumbbell />,
  },
  {
    title: 'Сон и восстановление',
    description: 'Ваша динамика и техники',
    screen: 'progress',
    icon: <IconMoon />,
  },
  {
    title: 'Гормональное и интимное здоровье',
    description: 'О теле и гормонах простыми словами',
    screen: 'guide',
    icon: <IconHeart />,
  },
  {
    title: 'Эмоциональное здоровье',
    description: 'Техники для настроения и стресса',
    screen: 'techniques',
    icon: <IconWave />,
  },
  {
    title: 'Окружение и смысл',
    description: 'Что помогает, а что мешает',
    screen: 'guide',
    icon: <IconLeaf />,
  },
];

interface WellnessGridProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function WellnessGrid({ onNavigate }: WellnessGridProps) {
  return (
    <div className="sw-wellness-grid">
      {AREAS.map((area) => (
        <WellnessAreaCard
          key={area.title}
          icon={area.icon}
          title={area.title}
          description={area.description}
          onClick={() => onNavigate(area.screen)}
        />
      ))}
    </div>
  );
}
