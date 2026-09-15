// AnketaOptionList.tsx — вертикальный список для одиночного выбора (анкета онбординга,
// Срез О2, шаги 2/3/4/5 и подвопросы шага 6). Ничего похожего в проекте ещё не было:
// .lang-toggle — горизонтальная пара коротких пилюль, не подходит для длинных подписей
// вариантов ("После операции (удаление яичников)") в вертикальный список — поэтому новый
// компонент, а не переиспользование существующего. Стилистически развивает уже принятый
// язык .protocol-card/.btn-secondary (var(--secondary-bg), var(--card-radius)), не вводит
// новую палитру.
import { hapticFeedbackSelectionChanged } from '@telegram-apps/sdk';
import type { AnketaOption } from '../content/anketa';

interface AnketaOptionListProps {
  options: AnketaOption[];
  selected: string | null;
  onSelect: (value: string) => void;
}

export default function AnketaOptionList({ options, selected, onSelect }: AnketaOptionListProps) {
  const handleSelect = (value: string) => {
    if (value !== selected && hapticFeedbackSelectionChanged.isAvailable()) {
      hapticFeedbackSelectionChanged();
    }
    onSelect(value);
  };

  return (
    <div className="anketa-options">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`anketa-option${selected === option.value ? ' selected' : ''}`}
          onClick={() => handleSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
