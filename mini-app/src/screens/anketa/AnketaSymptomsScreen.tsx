// AnketaSymptomsScreen.tsx — анкета онбординга, Шаг 7, чек-лист симптомов (ТЗ v2.13,
// 6.2.2): мультивыбор чекбоксами по 6 категориям, без баллов и без итогового вывода —
// раздел 13 ТЗ прямо запрещает валидированные опросники со скорингом, здесь их и нет,
// просто список того, что отмечено. НЕ подключён к навигации (Срез О2, Промпт 2/4).
//
// Пункт "депрессивные мысли" (категория "Настроение") оставлен по прямому решению Надиры
// от 15.09.2026 несмотря на близость к теме психического здоровья — простой чекбокс, не
// запускает safety-сценарий раздела 5.8/6.10 напрямую (нет анализа свободного текста), но
// ТРЕБУЕТ REVIEW ГИНЕКОЛОГОМ-СОУЧРЕДИТЕЛЕМ ПЕРЕД ПУБЛИКАЦИЕЙ В ПРОДЕ, как и весь клинически
// звучащий контент продукта (см. content/anketa.ts, STEP7_SYMPTOMS, ключ 'depressive_thoughts',
// где стоит тот же комментарий на источнике текста).
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useMainButton } from '../../lib/useMainButton';
import { STEP7_SYMPTOMS, ANKETA_COMMON, type Lang } from '../../content/anketa';

interface AnketaSymptomsScreenProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onNext: () => void;
}

// { категория: Set<выбранный item value> } — Set, а не массив, чтобы toggle был O(1) и
// не плодил дубликаты при повторном клике.
type Selection = Record<string, Set<string>>;

export default function AnketaSymptomsScreen({ lang, onLangChange, onNext }: AnketaSymptomsScreenProps) {
  const [selection, setSelection] = useState<Selection>({});
  const [submitting, setSubmitting] = useState(false);

  const t = STEP7_SYMPTOMS[lang];
  const common = ANKETA_COMMON[lang];

  const toggleItem = (categoryKey: string, itemValue: string) => {
    setSelection((prev) => {
      const current = new Set(prev[categoryKey] ?? []);
      if (current.has(itemValue)) {
        current.delete(itemValue);
      } else {
        current.add(itemValue);
      }
      return { ...prev, [categoryKey]: current };
    });
  };

  const handleNext = async () => {
    if (submitting) return;

    // Только непустые категории — компактнее в JSONB и честнее отражает "ничего не
    // отмечено" как отсутствие ключа, а не пустой массив.
    const checklist: Record<string, string[]> = {};
    for (const [categoryKey, items] of Object.entries(selection)) {
      if (items.size > 0) checklist[categoryKey] = Array.from(items);
    }

    if (Object.keys(checklist).length > 0) {
      setSubmitting(true);
      try {
        await apiFetch('/anketa/symptoms', { method: 'POST', body: JSON.stringify({ checklist }) });
      } catch {
        // Не блокируем прохождение анкеты сетевой ошибкой.
      }
      setSubmitting(false);
    }
    onNext();
  };

  useMainButton({
    text: common.next,
    onClick: handleNext,
    isEnabled: !submitting,
    isLoaderVisible: submitting,
  });

  return (
    <main className="screen">
      <div className="lang-toggle">
        <button type="button" className={lang === 'ru' ? 'active' : ''} onClick={() => onLangChange('ru')}>
          RU
        </button>
        <button type="button" className={lang === 'kk' ? 'active' : ''} onClick={() => onLangChange('kk')}>
          KK
        </button>
      </div>

      <p className="eyebrow">SanaWell</p>
      <p className="anketa-hint" style={{ marginBottom: 4 }}>
        {t.title}
      </p>

      {t.categories.map((category) => (
        <div className="anketa-checklist-category" key={category.key}>
          <p className="module-heading">{category.label}</p>
          {category.items.map((item) => (
            <label className="anketa-checkbox-row" key={item.value}>
              <input
                type="checkbox"
                checked={selection[category.key]?.has(item.value) ?? false}
                onChange={() => toggleItem(category.key, item.value)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      ))}
    </main>
  );
}
