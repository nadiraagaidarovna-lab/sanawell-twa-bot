// BodyScreen.tsx — папка «Тело» (Срез Д, ТЗ 4.4.1). Плейсхолдер «Готовим, скоро» из Промпта
// 1/5 заменён статичным разделом с физнагрузками (content/bodyExercises.ts, 5 разделов):
// аккордеон «раздел → упражнение» на нативных <details>, дисклеймер сверху, врезки-
// предостережения выделены отдельным блоком. Без MainButton, поля ввода и вызовов /api/*,
// без иллюстраций. Контент опубликован БЕЗ review гинеколога — решение Надиры 21.09.2026,
// см. шапку content/bodyExercises.ts. «Интимное здоровье и гигиена» — отдельный будущий срез.
import { useEffect, useRef } from 'react';
import BottomNav from '../components/BottomNav';
import { BODY_DISCLAIMER, BODY_SECTIONS, type ExerciseItem } from '../content/bodyExercises';
import { consumeBodyTarget } from '../lib/bodyTarget';

// Упражнение без описания/шагов — просто строка списка, раскрывать в нём нечего.
function hasBody(item: ExerciseItem): boolean {
  return !!(item.description || item.why || item.steps?.length || item.footer || item.note);
}

function Note({ text }: { text: string }) {
  return (
    <div className="ex-note" role="note">
      <span className="ex-note-icon" aria-hidden="true">
        ⚠️
      </span>
      <p>{text}</p>
    </div>
  );
}

export default function BodyScreen() {
  const mainRef = useRef<HTMLElement>(null);

  // Вход по ссылке из «Самочувствия» («Загляните в «Тело»: …», lib/bodyTarget.ts): раскрываем
  // нужную секцию и упражнение и прокручиваем к нему. <details> здесь не controlled — точечно
  // выставляем open у двух элементов, обычное открытие/закрытие кликом не затронуто; без ссылки
  // (папка на главном экране, нижняя навигация) цели нет — все секции свёрнуты, как раньше.
  useEffect(() => {
    const target = consumeBodyTarget();
    const root = mainRef.current;
    if (!target || !root) return;

    const section = Array.from(root.querySelectorAll<HTMLDetailsElement>('details.ex-section')).find(
      (el) => el.dataset.section === target.sectionTitle
    );
    if (!section) return;
    section.open = true;

    const row = Array.from(section.querySelectorAll<HTMLElement>('[data-item]')).find(
      (el) => el.dataset.item === target.itemTitle
    );
    if (row instanceof HTMLDetailsElement) row.open = true;
    (row ?? section).scrollIntoView({ block: 'start' });
  }, []);

  return (
    <main className="screen v2-screen v2-accent-body" ref={mainRef}>
      <p className="eyebrow">SanaWell</p>
      <h1>Тело</h1>

      <p className="ex-disclaimer">{BODY_DISCLAIMER}</p>

      {BODY_SECTIONS.map((section) => (
        <details className="ex-section" key={section.title} data-section={section.title}>
          <summary className="ex-section-title">{section.title}</summary>
          <div className="ex-section-content">
            {section.intro && <p className="ex-p">{section.intro}</p>}
            {section.notes?.map((text) => <Note text={text} key={text} />)}
            {section.itemsLabel && <p className="ex-label">{section.itemsLabel}</p>}

            <div className="ex-items">
              {section.items.map((item) =>
                hasBody(item) ? (
                  <details className="ex-item" key={item.title} data-item={item.title}>
                    <summary className="ex-item-title">{item.title}</summary>
                    <div className="ex-item-body">
                      {item.description?.split('\n\n').map((paragraph) => (
                        <p className="ex-p" key={paragraph}>
                          {paragraph}
                        </p>
                      ))}
                      {item.why && <p className="ex-p ex-why">{item.why}</p>}
                      {item.stepsLabel && <p className="ex-label">{item.stepsLabel}</p>}
                      {item.steps && (
                        <ul className="ex-steps">
                          {item.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ul>
                      )}
                      {item.footer && <p className="ex-p">{item.footer}</p>}
                      {item.note && <Note text={item.note} />}
                    </div>
                  </details>
                ) : (
                  <div className="ex-item-static" key={item.title} data-item={item.title}>
                    {item.title}
                  </div>
                )
              )}
            </div>

            {section.outro && <p className="ex-p ex-outro">{section.outro}</p>}
          </div>
        </details>
      ))}

      <BottomNav active="body" />
    </main>
  );
}
