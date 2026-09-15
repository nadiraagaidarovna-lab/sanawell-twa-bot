import { createContext } from 'react';

// Срез О2, Промпт 3/4: 7 экранов анкеты (ТЗ v2.13, 6.2.2) между 'welcome' (Шаг 0, Срез О3)
// и 'home' — код самих экранов не в этом файле (см. screens/anketa/), здесь только ID
// для стека навигации, тот же паттерн, что у остальных ScreenId. Срез О5, Промпт 2/2:
// 'consent' — экран согласий (ТЗ раздел 13) между 'welcome' и анкетой.
export type ScreenId =
  | 'welcome'
  | 'consent'
  | 'anketa-name'
  | 'anketa-age'
  | 'anketa-stage'
  | 'anketa-path'
  | 'anketa-goal'
  | 'anketa-lifestyle'
  | 'anketa-symptoms'
  | 'home'
  | 'checkin'
  | 'progress'
  | 'techniques'
  | 'partners';

export interface NavigationContextValue {
  screen: ScreenId;
  canGoBack: boolean;
  push: (screen: ScreenId) => void;
  back: () => void;
}

export const NavigationContext = createContext<NavigationContextValue | null>(null);
