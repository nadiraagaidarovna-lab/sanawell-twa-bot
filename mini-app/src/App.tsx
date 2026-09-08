// App.tsx — каркас навигации. NavigationProvider держит стек экранов,
// Screens подписывает нативную BackButton на "назад по стеку".
import { NavigationProvider } from './lib/navigation';
import { useNavigation } from './lib/useNavigation';
import { useBackButton } from './lib/useBackButton';
import WelcomeScreen from './screens/WelcomeScreen';
import HomeScreen from './screens/HomeScreen';
import CheckinScreen from './screens/CheckinScreen';

function Screens() {
  const { screen, canGoBack, back } = useNavigation();

  useBackButton(canGoBack ? back : null);

  switch (screen) {
    case 'checkin':
      return <CheckinScreen />;
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
