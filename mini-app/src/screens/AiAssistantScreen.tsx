// AiAssistantScreen.tsx — пункт нижней навигации «AI ассистент» (Срез Д, Промпт 5/5, ТЗ
// 4.4.1/5.7). На первую версию — СТАТИЧНЫЙ FAQ (аккордеон «раздел → вопрос → ответ») из
// content/faq.ts, НЕ живой ИИ-чат: ни поля ввода, ни MainButton, ни вызовов /api/* (общий
// ИИ-помощник Plus/Premium — отдельная будущая доработка, раздел 5.7/10.3 ТЗ).
// Раскрытие — нативный <details>: своё состояние не нужно, доступность из коробки.
import { openLink } from '@telegram-apps/sdk';
import BottomNav from '../components/BottomNav';
import { FAQ_DISCLAIMER, FAQ_SECTIONS } from '../content/faq';

// Ссылки-источники открываем во внешнем браузере (openLink), а не внутри Mini App — тот же
// приём, что в PartnersScreen.tsx.
function openExternal(url: string) {
  if (openLink.isAvailable()) {
    openLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default function AiAssistantScreen() {
  return (
    <main className="screen v2-screen v2-accent-assistant">
      <p className="eyebrow">SanaWell</p>
      <h1>AI ассистент</h1>

      <p className="faq-disclaimer">{FAQ_DISCLAIMER}</p>

      {FAQ_SECTIONS.map((section, sectionIndex) => {
        const showGroupHeading =
          section.group !== undefined && FAQ_SECTIONS[sectionIndex - 1]?.group !== section.group;
        return (
          <div key={section.title}>
            {showGroupHeading && <p className="module-heading">{section.group}</p>}
            <details className="faq-section">
              <summary className="faq-section-title">{section.title}</summary>
              <div className="faq-items">
                {section.items.map((item) => (
                  <details className="faq-item" key={item.question}>
                    <summary className="faq-question">{item.question}</summary>
                    <p className="faq-answer">{item.answer}</p>
                    {item.sourceUrls && (
                      <p className="faq-sources">
                        {item.sourceUrls.map((url, i) => (
                          <button
                            type="button"
                            className="faq-source"
                            key={url}
                            onClick={() => openExternal(url)}
                          >
                            {item.sourceUrls && item.sourceUrls.length > 1 ? `Источник ${i + 1}` : 'Источник'}
                          </button>
                        ))}
                      </p>
                    )}
                  </details>
                ))}
              </div>
            </details>
          </div>
        );
      })}

      <BottomNav active="ai-assistant" />
    </main>
  );
}
