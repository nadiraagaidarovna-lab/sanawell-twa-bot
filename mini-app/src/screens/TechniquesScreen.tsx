// TechniquesScreen.tsx — «Все техники самопомощи» на /checkin/ (Срез Б, ТЗ 5.4/5.5, см.
// CLAUDE.md): полная библиотека немедикаментозных техник поверх уже существующего
// GET /api/protocols. Каждая карточка — с объяснением физиологического механизма
// (раздел 5.4 ТЗ, тексты утверждены Надирой) вместо однострочного note.
// Срез Т добавил модули 'nutrition'/'strength' (питание, силовые/весонесущие нагрузки) —
// самостоятельные направления библиотеки, не привязанные к измерениям чек-ина.
// Срез Д, Промпт 2/5 (ТЗ 4.4.1): это экран, на который ведёт папка «Мой план поддержки» —
// переведён на пудровую v2-тему (класс v2-screen) + нижняя навигация, ни контент, ни
// GET /api/protocols, ни MODULE_LABELS/MODULE_ORDER не менялись. Перегруппировка этих
// 5 модулей в 5 направлений wellness-плана по разделу 4.4.1 (Когнитивное здоровье/
// Нейропластичность/Физическая нагрузка/Питание и нутрициология/Психологическое
// благополучие) — отдельный, ещё не сделанный шаг, не этот промпт.
// Срез Д, Промпт 3/5: добавлен класс v2-accent-c2 — без него заголовки .module-heading
// красились бы в акцент папки «Самочувствие» (ProgressScreen.tsx тоже получил v2-screen
// в этом промпте, а правило было общим на .v2-screen — конфликт исправлен разбивкой на
// per-папку акцентные классы, см. index.css).
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import BottomNav from '../components/BottomNav';

interface Protocol {
  id: string;
  title: string;
  duration: string;
  steps: string[];
  note: string;
}

type ProtocolsByModule = Record<string, Protocol[]>;

type ViewState = 'loading' | 'loaded' | 'error';

const MODULE_LABELS: Record<string, string> = {
  sleep: 'Сон',
  mood: 'Настроение',
  cognitive: 'Голова',
  nutrition: 'Питание',
  strength: 'Сила и кости',
};

const MODULE_ORDER = ['sleep', 'mood', 'cognitive', 'nutrition', 'strength'];

export default function TechniquesScreen() {
  const [view, setView] = useState<ViewState>('loading');
  const [protocols, setProtocols] = useState<ProtocolsByModule>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ protocols: ProtocolsByModule }>('/protocols')
      .then(({ protocols: byModule }) => {
        if (cancelled) return;
        setProtocols(byModule);
        setView('loaded');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'Сеть недоступна');
        setView('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="screen v2-screen v2-accent-c2">
      <p className="eyebrow">SanaWell</p>
      <h1>Все техники самопомощи</h1>

      {view === 'loading' && (
        <p className="body-text" style={{ color: 'var(--v2-ink-soft)' }}>
          Загружаю…
        </p>
      )}

      {view === 'error' && (
        <p className="body-text" style={{ color: 'var(--v2-terracotta)' }}>
          Не удалось загрузить: {error}
        </p>
      )}

      {view === 'loaded' &&
        MODULE_ORDER.filter((moduleName) => protocols[moduleName]?.length).map((moduleName) => (
          <section key={moduleName}>
            <p className="module-heading">{MODULE_LABELS[moduleName]}</p>
            <div className="protocol-list">
              {protocols[moduleName].map((protocol) => (
                <div className="protocol-card" key={protocol.id}>
                  <div className="protocol-card-header">
                    <span className="protocol-title">{protocol.title}</span>
                    <span className="protocol-duration">{protocol.duration}</span>
                  </div>
                  <ol className="protocol-steps">
                    {protocol.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <p className="protocol-note">{protocol.note}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

      <BottomNav active="techniques" />
    </main>
  );
}
