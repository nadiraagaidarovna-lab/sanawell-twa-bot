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
}

export function useMainButton({ text, onClick, isEnabled = true }: MainButtonOptions): void {
  useEffect(() => {
    if (mountMainButton.isAvailable() && !isMainButtonMounted()) {
      mountMainButton();
    }
    if (setMainButtonParams.isAvailable()) {
      setMainButtonParams({ text, isVisible: true, isEnabled });
    }

    const off = onMainButtonClick.isAvailable() ? onMainButtonClick(onClick) : undefined;

    return () => {
      off?.();
      if (setMainButtonParams.isAvailable()) setMainButtonParams({ isVisible: false });
    };
  }, [text, onClick, isEnabled]);
}
