// navigation.tsx — минимальный стек экранов без роутинг-библиотеки: полноценный роутер
// был бы преждевременным усложнением для нескольких линейных экранов. Стек (а не один
// screen-стейт) — чтобы "Назад" всегда возвращал на предыдущий экран, а не жёстко на
// "home". Начальный экран настраивается через initialScreen (Срез О3) — App.tsx решает
// 'welcome' vs 'home' по гейту onboarding_welcome_seen ДО монтирования этого провайдера,
// чтобы не плодить лишнюю запись в стеке редиректом изнутри уже смонтированного экрана.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { NavigationContext, type NavigationContextValue, type ScreenId } from './navigationContext';

export function NavigationProvider({
  children,
  initialScreen = 'welcome',
}: {
  children: ReactNode;
  initialScreen?: ScreenId;
}) {
  const [stack, setStack] = useState<ScreenId[]>([initialScreen]);

  const push = useCallback((screen: ScreenId) => {
    setStack((prev) => [...prev, screen]);
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback((screen: ScreenId) => {
    setStack([screen]);
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      screen: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      push,
      reset,
      back,
    }),
    [stack, push, back, reset],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
