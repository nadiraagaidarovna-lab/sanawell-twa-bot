// ScaleSlider.tsx — шкала 1–10 для чек-ина (ТЗ 5.1/6.3: "кнопки/слайдер"). Крупный,
// легко нажимаемый ползунок (ТЗ 9.4 — WCAG AA, аудитория 40+), с текущим значением
// крупным текстом и тактильным откликом при каждом изменении (ТЗ 4.1: HapticFeedback).
import { hapticFeedbackSelectionChanged } from '@telegram-apps/sdk';

interface ScaleSliderProps {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}

export default function ScaleSlider({ label, hint, value, onChange }: ScaleSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    if (next !== value && hapticFeedbackSelectionChanged.isAvailable()) {
      hapticFeedbackSelectionChanged();
    }
    onChange(next);
  };

  return (
    <div className="scale">
      <div className="scale-header">
        <span className="scale-label">{label}</span>
        <span className="scale-value">{value}</span>
      </div>
      <p className="scale-hint">{hint}</p>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={handleChange}
        className="scale-input"
        aria-label={`${label}: ${value} из 10`}
      />
    </div>
  );
}
