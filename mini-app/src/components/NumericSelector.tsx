import { useId } from 'react';
import { hapticFeedbackSelectionChanged } from '@telegram-apps/sdk';
import './NumericSelector.css';

interface NumericSelectorProps {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}

export default function NumericSelector({ label, hint, value, onChange }: NumericSelectorProps) {
  const id = useId();
  const selectValue = (next: number) => {
    if (next !== value && hapticFeedbackSelectionChanged.isAvailable()) {
      hapticFeedbackSelectionChanged();
    }
    onChange(next);
  };

  return (
    <div className="scale numeric-selector">
      <div className="scale-header">
        <span className="scale-label" id={id + '-label'}>{label}</span>
        <span className="scale-value">{value}</span>
      </div>
      <p className="scale-hint" id={id + '-hint'}>{hint}</p>
      <div className="numeric-selector-grid" role="group"
        aria-labelledby={id + '-label'} aria-describedby={id + '-hint'}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => (
          <button key={number} type="button" className="numeric-selector-option"
            aria-label={number + ' из 10'} aria-pressed={value === number}
            onClick={() => selectValue(number)}>
            {number}
          </button>
        ))}
      </div>
    </div>
  );
}
