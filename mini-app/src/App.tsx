// App.tsx — каркас навигации. NavigationProvider держит стек экранов,
// Screens подписывает нативную BackButton на "назад по стеку".
//
// Срез О3 (ТЗ v2.12, 6.2.1): начальный экран больше не всегда 'welcome' — сначала один
// GET /api/me решает, показывать ли Шаг 0 (onboardingWelcomeSeen === false) или сразу
// главный экран для уже прошедших его пользователей. Тот же вызов уже несёт сохранённый
// язык (savedLanguage) — передаём его в WelcomeScreen, чтобы не делать второй запрос.
import { useEffect, useState } from 'react';
import { NavigationProvider } from './lib/navigation';
import { useNavigation } from './lib/useNavigation';
import { useBackButton } from './lib/useBackButton';
import { apiFetch } from './lib/api';
import WelcomeScreen from './screens/WelcomeScreen';
import HomeScreen from './screens/HomeScreen';
import CheckinScreen from './screens/CheckinScreen';
import ProgressScreen from './screens/ProgressScreen';
import TechniquesScreen from './screens/TechniquesScreen';
import PartnersScreen from './screens/PartnersScreen';
import type { ScreenId } from './lib/navigationContext';

interface MeGateResponse {
  onboardingWelcomeSeen: boolean;
  language: string | null;
}

function Screens({ savedLanguage }: { savedLanguage: string | null }) {
  const { screen, canGoBack, back } = useNavigation();

  useBackButton(canGoBack ? back : null);

  switch (screen) {
    case 'checkin':
      return <CheckinScreen />;
    case 'progress':
      return <ProgressScreen />;
    case 'techniques':
      return <TechniquesScreen />;
    case 'partners':
      return <PartnersScreen />;
    case 'home':
      return <HomeScreen />;
    case 'welcome':
    default:
      return <WelcomeScreen savedLanguage={savedLanguage} />;
  }
}

type GateState =
  | { status: 'loading' }
  | { status: 'ready'; initialScreen: ScreenId; savedLanguage: string | null };

function App() {
  const [gate, setGate] = useState<GateState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    apiFetch<MeGateResponse>('/me')
      .then((me) => {
        if (cancelled) return;
        setGate({
          status: 'ready',
          initialScreen: me.onboardingWelcomeSeen ? 'home' : 'welcome',
          savedLanguage: me.language,
        });
      })
      .catch(() => {
        // Не можем подтвердить initData/достучаться до сервера — безопаснее показать Шаг 0
        // ещё раз, чем молча пропустить его для новой пользовательницы.
        if (!cancelled) setGate({ status: 'ready', initialScreen: 'welcome', savedLanguage: null });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (gate.status === 'loading') {
    return <main className="screen" />;
  }

  return (
    <NavigationProvider initialScreen={gate.initialScreen}>
      <Screens savedLanguage={gate.savedLanguage} />
    </NavigationProvider>
  );
}

export default App;
