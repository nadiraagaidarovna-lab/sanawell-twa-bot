// useMainButton.ts — декларативная обёртка над нативной MainButton Telegram
// (ТЗ 4.1: MainButton вместо кастомных кнопок «Далее»/«Отправить»).
import { useEffect } from 'react';
import {
  isMainButtonMounted,
  mountMainButton,
  onMainButtonClick,
  setMainButtonParams,
} from '@telegram-apps/sdk';

const MAIN_BUTTON_BG = '#c1613f';
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
      // Цвет задаём сами, а не оставляем теме Telegram: иначе кнопка «Начать»/«Продолжить»
      // и др. рисуется системным (часто синим) цветом и выбивается из терракотовой гаммы
      // приложения. #c1613f — тот же терракотовый, что --sw-terracotta/--v2-terracotta
      // (светлая тема); размер нативной кнопки приложение менять не может.
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
