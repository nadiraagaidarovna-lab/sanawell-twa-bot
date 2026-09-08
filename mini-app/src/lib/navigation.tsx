// navigation.tsx — минимальный стек экранов без роутинг-библиотеки: пока в приложении
// два экрана (Главная → Чек-ин), полноценный роутер был бы преждевременным усложнением.
// Стек (а не один screen-стейт) — чтобы "Назад" всегда возвращал на предыдущий экран,
// а не жёстко на "home", когда экранов станет больше (Срез 2+).
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { NavigationContext, type NavigationContextValue, type ScreenId } from './navigationContext';

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ScreenId[]>(['home']);

  const push = useCallback((screen: ScreenId) => {
    setStack((prev) => [...prev, screen]);
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      screen: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      push,
      back,
    }),
    [stack, push, back],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
