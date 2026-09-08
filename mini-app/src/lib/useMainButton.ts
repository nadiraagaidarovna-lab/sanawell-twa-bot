// useMainButton.ts — декларативная обёртка над нативной MainButton Telegram
// (ТЗ 4.1: MainButton вместо кастомных кнопок «Далее»/«Отправить»).
import { useEffect } from 'react';
import {
  isMainButtonMounted,
  mountMainButton,
  onMainButtonClick,
  setMainButtonParams,
} from '@telegram-apps/sdk';

interface MainButtonOptions {
  text: string;
  onClick: () => void;
  isEnabled?: boolean;
  isLoaderVisible?: boolean;
  /** false — скрыть кнопку целиком (например, экран уже показывает подтверждение,
   * а не форму с основным действием). По умолчанию true. */
  isVisible?: boolean;
}

export function useMainButton({
  text,
  onClick,
  isEnabled = true,
  isLoaderVisible = false,
  isVisible = true,
}: MainButtonOptions): void {
  useEffect(() => {
    if (!isVisible) {
      if (setMainButtonParams.isAvailable()) setMainButtonParams({ isVisible: false });
      return undefined;
    }

    if (mountMainButton.isAvailable() && !isMainButtonMounted()) {
      mountMainButton();
    }
    if (setMainButtonParams.isAvailable()) {
      setMainButtonParams({ text, isVisible: true, isEnabled, isLoaderVisible });
    }

    const off = onMainButtonClick.isAvailable() ? onMainButtonClick(onClick) : undefined;

    return () => {
      off?.();
      if (setMainButtonParams.isAvailable()) setMainButtonParams({ isVisible: false });
    };
  }, [text, onClick, isEnabled, isLoaderVisible, isVisible]);
}
