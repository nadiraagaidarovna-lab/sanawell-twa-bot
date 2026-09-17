// AiAssistantScreen.tsx — плейсхолдер пункта нижней навигации «AI ассистент» (Срез Д,
// Промпт 1/5, ТЗ 4.4.1). На первую версию — статичный FAQ/помощь, НЕ живой ИИ-чат
// (раздел 5.7/10.3 ТЗ — полноценный чат отдельная будущая доработка). Тексты FAQ —
// Промпт 5/5, ещё не готовы. Экран кликабелен и открывается нормально.
import BottomNav from '../components/BottomNav';

export default function AiAssistantScreen() {
  return (
    <main className="screen v2-screen">
      <p className="eyebrow">SanaWell</p>
      <h1>AI ассистент</h1>
      <p className="body-text">Готовим, скоро 💛</p>
      <BottomNav active="ai-assistant" />
    </main>
  );
}
