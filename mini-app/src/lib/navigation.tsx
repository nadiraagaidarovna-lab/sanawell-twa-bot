// navigation.tsx — минимальный стек экранов без роутинг-библиотеки: полноценный роутер
// был бы преждевременным усложнением для нескольких линейных экранов. Стек (а не один
// screen-стейт) — чтобы "Назад" всегда возвращал на предыдущий экран, а не жёстко на
// "home". Начальный экран — welcome (ТЗ 6.2, шаг 1); полная последовательность онбординга
// (вопрос о пути менопаузы, язык, согласия) добавится следующими срезами Этапа 2.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { NavigationContext, type NavigationContextValue, type ScreenId } from './navigationContext';

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ScreenId[]>(['welcome']);

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
