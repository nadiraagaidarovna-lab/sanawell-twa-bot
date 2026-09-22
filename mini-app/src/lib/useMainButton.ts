// useMainButton.ts — декларативная обёртка над нативной MainButton Telegram
// (ТЗ 4.1: MainButton вместо кастомных кнопок «Далее»/«Отправить»).
import { useEffect } from 'react';
import {
  isMainButtonMounted,
  mountMainButton,
  onMainButtonClick,
  setMainButtonParams,
} from '@telegram-apps/sdk';

const MAIN_BUTTON_BG = '#3f7563';
const MAIN_BUTTON_TEXT = '#ffffff';

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
      // Keep the native action in the SanaWell sage palette, independently of Telegram theme.
      setMainButtonParams({
        text,
        isVisible: true,
        isEnabled,
        isLoaderVisible,
        backgroundColor: MAIN_BUTTON_BG,
        textColor: MAIN_BUTTON_TEXT,
      });
    }

    const off = onMainButtonClick.isAvailable() ? onMainButtonClick(onClick) : undefined;

    return () => {
      off?.();
      if (setMainButtonParams.isAvailable()) setMainButtonParams({ isVisible: false });
    };
  }, [text, onClick, isEnabled, isLoaderVisible, isVisible]);
}
