// navigation.tsx — минимальный стек экранов без роутинг-библиотеки: полноценный роутер
// был бы преждевременным усложнением для нескольких линейных экранов. Стек (а не один
// screen-стейт) — чтобы "Назад" всегда возвращал на предыдущий экран, а не жёстко на
// "home". Начальный экран настраивается через initialScreen (Срез О3) — App.tsx решает
// 'welcome' vs 'home' по гейту onboarding_welcome_seen ДО монтирования этого провайдера,
// чтобы не плодить лишнюю запись в стеке редиректом изнутри уже смонтированного экрана.
import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { screenChanged } from './buildCheck';
import { NavigationContext, type NavigationContextValue, type ScreenId } from './navigationContext';

export function NavigationProvider({
  children,
  initialScreen = 'welcome',
}: {
  children: ReactNode;
  initialScreen?: ScreenId;
}) {
  const [stack, setStack] = useState<ScreenId[]>([initialScreen]);

  // Every new screen starts at its top: otherwise a screen opened from far down Home inherits
  // that scroll and its heading is out of view. Screens that scroll to a target themselves
  // (BodyScreen) do it in a later effect.
  const top = stack[stack.length - 1];
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    screenChanged();
  }, [top, stack.length]);

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
