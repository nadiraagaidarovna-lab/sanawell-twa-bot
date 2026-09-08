import { createContext } from 'react';

export type ScreenId = 'welcome' | 'home' | 'checkin';

export interface NavigationContextValue {
  screen: ScreenId;
  canGoBack: boolean;
  push: (screen: ScreenId) => void;
  back: () => void;
}

export const NavigationContext = createContext<NavigationContextValue | null>(null);
