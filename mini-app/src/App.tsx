// App.tsx — Срез 0: пустой каркас, подтверждающий, что SDK и тема Telegram
// применились. Навигация между экранами — Срез 1, initData-запрос к бэкенду — Срез 2.
function App() {
  return (
    <main style={{ padding: '16px 16px 32px' }}>
      <p
        style={{
          color: 'var(--sw-gold)',
          fontSize: 13,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          margin: '4px 0 8px',
        }}
      >
        SanaWell
      </p>
      <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>Mini App — каркас готов</h1>
      <p style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>
        Тема и SDK Telegram инициализированы. Дальше — навигация и экран чек-ина.
      </p>
    </main>
  );
}

export default App;
