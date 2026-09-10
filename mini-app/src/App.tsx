// App.tsx — каркас навигации. NavigationProvider держит стек экранов,
// Screens подписывает нативную BackButton на "назад по стеку".
import { NavigationProvider } from './lib/navigation';
import { useNavigation } from './lib/useNavigation';
import { useBackButton } from './lib/useBackButton';
import WelcomeScreen from './screens/WelcomeScreen';
import HomeScreen from './screens/HomeScreen';
import CheckinScreen from './screens/CheckinScreen';
import ProgressScreen from './screens/ProgressScreen';
import TechniquesScreen from './screens/TechniquesScreen';
import PartnersScreen from './screens/PartnersScreen';

function Screens() {
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
      return <WelcomeScreen />;
  }
}

function App() {
  return (
    <NavigationProvider>
      <Screens />
    </NavigationProvider>
  );
}

export default App;
