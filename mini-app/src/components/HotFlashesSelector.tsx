import { hapticFeedbackSelectionChanged } from '@telegram-apps/sdk';
import './HotFlashesSelector.css';

import { HOT_FLASHES_LABELS, type HotFlashes } from '../content/checkin';

export default function HotFlashesSelector({ value, onChange }: {
  value: HotFlashes | null;
  onChange: (value: HotFlashes) => void;
}) {
  return (
    <div className="scale">
      <div className="scale-header"><span className="scale-label">Приливы и ночная потливость</span></div>
      <p className="scale-hint">Были ли у вас сегодня приливы или ночная потливость?</p>
      <div className="hot-flashes-options" role="group"
        aria-label="Были ли у вас сегодня приливы или ночная потливость?">
        {(Object.keys(HOT_FLASHES_LABELS) as HotFlashes[]).map((option) => (
          <button key={option} type="button" className="numeric-selector-option"
            aria-pressed={value === option} onClick={() => {
              if (option !== value && hapticFeedbackSelectionChanged.isAvailable()) {
                hapticFeedbackSelectionChanged();
              }
              onChange(option);
            }}>
            {HOT_FLASHES_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
