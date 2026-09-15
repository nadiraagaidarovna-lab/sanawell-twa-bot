// App.tsx — каркас навигации. NavigationProvider держит стек экранов,
// Screens подписывает нативную BackButton на "назад по стеку".
//
// Срез О3 (ТЗ v2.12, 6.2.1): начальный экран решает один GET /api/me — Шаг 0
// (onboardingWelcomeSeen === false) либо сразу home. Срез О2, Промпт 3/4 (ТЗ v2.13, 6.2.2)
// вставляет анкету (7 шагов, screens/anketa/) МЕЖДУ Шагом 0 и home: тот же GET /api/me
// добавочно проверяет onboardingAnketaCompleted, решая и стартовый экран, и то, куда
// ведёт кнопка "Начать" на Шаге 0 (welcomeNextScreen) — WelcomeScreen.tsx сам ничего не
// знает про анкету, только принимает готовое решение сверху (см. его собственный коммент).
// Срез О5, Промпт 2/2 (ТЗ v2.13, раздел 13): между Шагом 0 и анкетой добавлен экран
// согласий (ConsentScreen, готов в Промпте 1/2) — тот же GET /api/me проверяет оба
// согласия (dataStorageConsented/medicalDisclaimerConsented, поля и эндпоинты из Среза О1),
// решая, показывать ли 'consent' вместо анкеты/home. ConsentScreen.tsx, как и WelcomeScreen,
// сам не знает, куда ведёт "Продолжить" — получает готовое решение сверху.
import { useEffect, useState } from 'react';
import { NavigationProvider } from './lib/navigation';
import { useNavigation } from './lib/useNavigation';
import { useBackButton } from './lib/useBackButton';
import { apiFetch } from './lib/api';
import WelcomeScreen from './screens/WelcomeScreen';
import ConsentScreen from './screens/ConsentScreen';
import HomeScreen from './screens/HomeScreen';
import CheckinScreen from './screens/CheckinScreen';
import ProgressScreen from './screens/ProgressScreen';
import TechniquesScreen from './screens/TechniquesScreen';
import PartnersScreen from './screens/PartnersScreen';
import AnketaNameScreen from './screens/anketa/AnketaNameScreen';
import AnketaAgeScreen from './screens/anketa/AnketaAgeScreen';
import AnketaStageScreen from './screens/anketa/AnketaStageScreen';
import AnketaPathScreen from './screens/anketa/AnketaPathScreen';
import AnketaGoalScreen from './screens/anketa/AnketaGoalScreen';
import AnketaLifestyleScreen from './screens/anketa/AnketaLifestyleScreen';
import AnketaSymptomsScreen from './screens/anketa/AnketaSymptomsScreen';
import type { ScreenId } from './lib/navigationContext';
import type { Lang } from './content/anketa';

interface MeGateResponse {
  onboardingWelcomeSeen: boolean;
  onboardingAnketaCompleted: boolean;
  dataStorageConsented: boolean;
  medicalDisclaimerConsented: boolean;
  language: string | null;
}

// Экран согласий обязателен (ТЗ раздел 13) — показываем, пока не даны ОБА согласия.
function needsConsent(me: MeGateResponse): boolean {
  return !me.dataStorageConsented || !me.medicalDisclaimerConsented;
}

// Куда вести после согласий (или сразу, если согласия уже даны и экран пропущен) — та же
// логика, что раньше была "куда ведёт Шаг 0", просто вынесена в отдельную функцию, т.к.
// теперь между ними может быть экран согласий.
function afterConsentScreen(me: MeGateResponse): ScreenId {
  return me.onboardingAnketaCompleted ? 'home' : 'anketa-name';
}

// Срез О2, Промпт 3/4 — порядок шагов анкеты (ТЗ 6.2.2), сразу после Шага 0 (Срез О3) и
// до главного экрана. Тот же порядок используется и для расчёта стартового экрана, и для
// перехода "следующий шаг" внутри самой анкеты (см. AnketaStepScreen ниже).
const ANKETA_STEPS: ScreenId[] = [
  'anketa-name',
  'anketa-age',
  'anketa-stage',
  'anketa-path',
  'anketa-goal',
  'anketa-lifestyle',
  'anketa-symptoms',
];

function isAnketaStep(screen: ScreenId): boolean {
  return (ANKETA_STEPS as string[]).includes(screen);
}

declare global {
  interface Window {
    Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } };
  }
}

// Та же логика приоритета, что в WelcomeScreen.tsx (сохранённый язык > авто-детект по
// Telegram > 'ru') — дублируется здесь, а не импортируется оттуда: тот файл не трогаем
// (Срез О3), а начальный язык анкеты нужен независимо от него. Единственный известный
// разрыв непрерывности: если на Шаге 0 женщина вручную переключила язык на тот, что
// ОТЛИЧАЕТСЯ от авто-детекта, и тут же (без выхода из Mini App) попала в анкету — анкета
// откроется на авто-детекте, а не на только что выбранном вручную языке, потому что этот
// выбор ещё не долетел обратно в App.tsx (savedLanguage взят один раз при монтировании).
// Второстепенный сценарий (реальный Telegram language_code почти всегда и так совпадает с
// предпочитаемым языком), самокорректируется при следующем открытии Mini App, когда
// сохранённый выбор уже точно на сервере.
function resolveInitialLang(savedLanguage: string | null): Lang {
  if (savedLanguage === 'ru' || savedLanguage === 'kk') return savedLanguage;
  const tgCode = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  return tgCode === 'kk' ? 'kk' : 'ru';
}

interface AnketaStepScreenProps {
  screen: ScreenId;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
}

// Общий рендерер для всех 7 экранов анкеты (Промпт 2/4, сами компоненты не тронуты) —
// здесь только выбор компонента по screen и переход к следующему шагу; на последнем шаге —
// POST /api/anketa/complete и переход на home. Компоненты анкеты уже спроектированы как
// полностью управляемые (lang/onLangChange/onNext приходят снаружи) именно под такую обвязку.
function AnketaStepScreen({ screen, lang, onLangChange }: AnketaStepScreenProps) {
  const { push } = useNavigation();

  const stepIndex = ANKETA_STEPS.indexOf(screen);
  const isLastStep = stepIndex === ANKETA_STEPS.length - 1;

  const handleNext = async () => {
    if (isLastStep) {
      try {
        await apiFetch('/anketa/complete', { method: 'POST' });
      } catch {
        // Не блокируем переход на главный экран сетевой ошибкой — тот же паттерн, что и
        // в самих экранах анкеты: хуже было бы застрять на последнем шаге.
      }
      push('home');
      return;
    }
    push(ANKETA_STEPS[stepIndex + 1]);
  };

  switch (screen) {
    case 'anketa-name':
      return <AnketaNameScreen lang={lang} onLangChange={onLangChange} onNext={handleNext} />;
    case 'anketa-age':
      return <AnketaAgeScreen lang={lang} onLangChange={onLangChange} onNext={handleNext} />;
    case 'anketa-stage':
      return <AnketaStageScreen lang={lang} onLangChange={onLangChange} onNext={handleNext} />;
    case 'anketa-path':
      return <AnketaPathScreen lang={lang} onLangChange={onLangChange} onNext={handleNext} />;
    case 'anketa-goal':
      return <AnketaGoalScreen lang={lang} onLangChange={onLangChange} onNext={handleNext} />;
    case 'anketa-lifestyle':
      return <AnketaLifestyleScreen lang={lang} onLangChange={onLangChange} onNext={handleNext} />;
    case 'anketa-symptoms':
      return <AnketaSymptomsScreen lang={lang} onLangChange={onLangChange} onNext={handleNext} />;
    default:
      return null;
  }
}

function Screens({
  savedLanguage,
  welcomeNextScreen,
  consentNextScreen,
}: {
  savedLanguage: string | null;
  welcomeNextScreen: ScreenId;
  consentNextScreen: ScreenId;
}) {
  const { screen, canGoBack, back, push } = useNavigation();
  // Один язык на всю анкету, не по экрану — переключение на любом шаге должно быть видно
  // на всех остальных, если вернуться назад, та же логика, что уже была бы у одного
  // многошагового экрана, просто анкета физически разбита на отдельные ScreenId. Экран
  // согласий переиспользует то же состояние языка (тот же непрерывный кусок онбординга).
  const [anketaLang, setAnketaLang] = useState<Lang>(() => resolveInitialLang(savedLanguage));

  useBackButton(canGoBack ? back : null);

  if (isAnketaStep(screen)) {
    return <AnketaStepScreen screen={screen} lang={anketaLang} onLangChange={setAnketaLang} />;
  }

  switch (screen) {
    case 'consent':
      return (
        <ConsentScreen lang={anketaLang} onLangChange={setAnketaLang} onNext={() => push(consentNextScreen)} />
      );
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
      return <WelcomeScreen savedLanguage={savedLanguage} nextScreen={welcomeNextScreen} />;
  }
}

type GateState =
  | { status: 'loading' }
  | {
      status: 'ready';
      initialScreen: ScreenId;
      savedLanguage: string | null;
      welcomeNextScreen: ScreenId;
      consentNextScreen: ScreenId;
    };

function App() {
  const [gate, setGate] = useState<GateState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    apiFetch<MeGateResponse>('/me')
      .then((me) => {
        if (cancelled) return;

        const consentNextScreen: ScreenId = afterConsentScreen(me);
        const welcomeNextScreen: ScreenId = needsConsent(me) ? 'consent' : consentNextScreen;
        const initialScreen: ScreenId = !me.onboardingWelcomeSeen ? 'welcome' : welcomeNextScreen;

        setGate({
          status: 'ready',
          initialScreen,
          savedLanguage: me.language,
          welcomeNextScreen,
          consentNextScreen,
        });
      })
      .catch(() => {
        // Не можем подтвердить initData/достучаться до сервера — безопаснее показать Шаг 0
        // ещё раз, чем молча пропустить его (и согласия/анкету за ним) для новой
        // пользовательницы. По той же логике, раз состояние согласий неизвестно —
        // welcomeNextScreen ведёт на 'consent', а не сразу на анкету.
        if (!cancelled) {
          setGate({
            status: 'ready',
            initialScreen: 'welcome',
            savedLanguage: null,
            welcomeNextScreen: 'consent',
            consentNextScreen: 'anketa-name',
          });
        }
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
      <Screens
        savedLanguage={gate.savedLanguage}
        welcomeNextScreen={gate.welcomeNextScreen}
        consentNextScreen={gate.consentNextScreen}
      />
    </NavigationProvider>
  );
}

export default App;
