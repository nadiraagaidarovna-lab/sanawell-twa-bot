// useBackButton.ts — декларативная обёртка над нативной кнопкой "Назад" Telegram
// (ТЗ 4.1: MainButton/BackButton вместо кастомных кнопок «Назад»/«Далее»).
// Передайте null, если на этом экране кнопка "Назад" не нужна (корневой экран).
import { useEffect } from 'react';
import {
  hideBackButton,
  isBackButtonMounted,
  mountBackButton,
  onBackButtonClick,
  showBackButton,
} from '@telegram-apps/sdk';

export function useBackButton(onClick: (() => void) | null): void {
  useEffect(() => {
    if (!onClick) return undefined;

    if (mountBackButton.isAvailable() && !isBackButtonMounted()) {
      mountBackButton();
    }
    if (showBackButton.isAvailable()) showBackButton();

    const off = onBackButtonClick.isAvailable() ? onBackButtonClick(onClick) : undefined;

    return () => {
      off?.();
      if (hideBackButton.isAvailable()) hideBackButton();
    };
  }, [onClick]);
}
