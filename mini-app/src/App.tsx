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
import { completeFocusGroupOnboarding } from './lib/onboardingFocusGroup';
import { setAnalyticsEnabled, track, useSectionAnalytics } from './lib/analytics';
import OnboardingFlow, { OnboardingNotice, OnboardingWelcomeAgain } from './screens/onboarding/OnboardingFlow';
import { getTelegramLanguageCode } from './lib/telegram';
import WelcomeScreen from './screens/WelcomeScreen';
import ConsentScreen from './screens/ConsentScreen';
import HomeScreen from './screens/HomeScreen';
import CheckinScreen, { type CheckinRecord } from './screens/CheckinScreen';
import CheckinResultScreen from './screens/CheckinResultScreen';
import ProgressScreen from './screens/ProgressScreen';
import TechniquesScreen from './screens/TechniquesScreen';
import PartnersScreen from './screens/PartnersScreen';
import GuideScreen from './screens/GuideScreen';
import BodyScreen from './screens/BodyScreen';
import AiAssistantScreen from './screens/AiAssistantScreen';
import CabinetScreen from './screens/CabinetScreen';
import ProfileEditScreen from './screens/ProfileEditScreen';
import TariffScreen from './screens/TariffScreen';
import EnvironmentScreen from './screens/EnvironmentScreen';
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
  onboardingVersion?: 'v2' | 'legacy' | 'paused';
  consents?: { current?: boolean };
  onboardingWelcomeSeen: boolean;
  onboardingAnketaCompleted: boolean;
  language: string | null;
}

// Consent to the CURRENT document version, confirmed by the server (consent_events). Old
// unversioned timestamps no longer count: such accounts are asked again, answers untouched.
function needsConsent(me: MeGateResponse): boolean {
  return me.consents?.current !== true;
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

// Sections counted by analytics (open + active time). Onboarding and legacy questionnaire
// screens are not sections: onboarding steps have their own events.
const ANALYTICS_SECTIONS: ScreenId[] = ['home', 'checkin', 'progress', 'techniques', 'partners', 'guide',
  'body', 'ai-assistant', 'cabinet', 'profile-edit', 'tariff', 'welcome-again', 'reconsent', 'topics-edit', 'environment'];

function isAnketaStep(screen: ScreenId): boolean {
  return (ANKETA_STEPS as string[]).includes(screen);
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
// Автодетект — getTelegramLanguageCode() (language_code из initData), а не
// window.Telegram.WebApp: скрипт telegram-web-app.js не подключён, прежний вариант всегда
// давал 'ru'.
function resolveInitialLang(savedLanguage: string | null): Lang {
  if (savedLanguage === 'ru' || savedLanguage === 'kk') return savedLanguage;
  return getTelegramLanguageCode() ?? 'ru';
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
  const { screen, canGoBack, back, push, reset } = useNavigation();
  // Один язык на всю анкету, не по экрану — переключение на любом шаге должно быть видно
  // на всех остальных, если вернуться назад, та же логика, что уже была бы у одного
  // многошагового экрана, просто анкета физически разбита на отдельные ScreenId. Экран
  // согласий переиспользует то же состояние языка (тот же непрерывный кусок онбординга).
  const [anketaLang, setAnketaLang] = useState<Lang>(() => resolveInitialLang(savedLanguage));

  const [checkinResult, setCheckinResult] = useState<CheckinRecord | null>(null);
  const closeCheckinResult = () => {
    setCheckinResult(null);
    if (screen !== 'home') push('home');
  };

  useBackButton(checkinResult ? closeCheckinResult : canGoBack ? back : null);
  useSectionAnalytics(checkinResult ? 'checkin-result' : ANALYTICS_SECTIONS.includes(screen) ? screen : null);

  if (checkinResult) {
    return <CheckinResultScreen checkin={checkinResult} onDone={closeCheckinResult}
      onProgress={() => { setCheckinResult(null); push('progress'); }} />;
  }

  if (isAnketaStep(screen)) {
    return <AnketaStepScreen screen={screen} lang={anketaLang} onLangChange={setAnketaLang} />;
  }

  switch (screen) {
    case 'onboarding-focus-group':
      return <OnboardingFlow onCheckin={async () => {
        await completeFocusGroupOnboarding();
        track({ name: 'onboarding_completed' });
        // Remove the entire onboarding history. Back from Check-in leads to Home.
        reset('home');
        push('checkin');
      }} />;
    case 'reconsent':
      // Completed account without consent to the current documents: only the consent page,
      // then Home. Onboarding answers and the completion flag are not touched.
      return <OnboardingFlow consentOnly onCheckin={() => reset('home')} />;
    case 'topics-edit':
      // Topics and main priority from the cabinet; answers are saved step by step.
      return <OnboardingFlow editTopics onCheckin={back} />;
    case 'welcome-again':
      return <OnboardingWelcomeAgain onClose={back} />;
    case 'onboarding-paused':
      return <OnboardingNotice title="Знакомство временно недоступно"
        text="Мы скоро вернёмся. Попробуйте открыть SanaWell AI немного позже." />;
    case 'consent':
      return (
        <ConsentScreen lang={anketaLang} onLangChange={setAnketaLang} onNext={() => push(consentNextScreen)} />
      );
    case 'checkin':
      return <CheckinScreen onSaved={setCheckinResult} />;
    case 'progress':
      return <ProgressScreen />;
    case 'techniques':
      return <TechniquesScreen />;
    case 'partners':
      return <PartnersScreen />;
    case 'guide':
      return <GuideScreen />;
    case 'body':
      return <BodyScreen />;
    case 'ai-assistant':
      return <AiAssistantScreen />;
    case 'cabinet':
      return <CabinetScreen />;
    case 'profile-edit':
      return <ProfileEditScreen />;
    case 'environment':
      return <EnvironmentScreen />;
    case 'tariff':
      return <TariffScreen />;
    case 'home':
      return <HomeScreen onCheckinSaved={setCheckinResult} />;
    case 'welcome':
    default:
      return <WelcomeScreen savedLanguage={savedLanguage} nextScreen={welcomeNextScreen} />;
  }
}

// Start screen from one GET /api/me. The server decides the onboarding version
// (ONBOARDING_VERSION_MODE), so the regular bot button needs no special link.
function initialScreenFor(me: MeGateResponse): ScreenId {
  if (me.onboardingAnketaCompleted) return needsConsent(me) ? 'reconsent' : 'home';
  if (me.onboardingVersion === 'v2') return 'onboarding-focus-group';
  if (me.onboardingVersion === 'paused') return 'onboarding-paused';
  if (!me.onboardingWelcomeSeen) return 'welcome';
  return needsConsent(me) ? 'consent' : afterConsentScreen(me);
}

type GateState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      initialScreen: ScreenId;
      savedLanguage: string | null;
      welcomeNextScreen: ScreenId;
      consentNextScreen: ScreenId;
    };

function App() {
  const [gate, setGate] = useState<GateState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    apiFetch<MeGateResponse>('/me')
      .then((me) => {
        if (cancelled) return;
        // Interaction analytics only with a current consent.
        setAnalyticsEnabled(me.consents?.current === true);

        const consentNextScreen: ScreenId = afterConsentScreen(me);
        const welcomeNextScreen: ScreenId = needsConsent(me) ? 'consent' : consentNextScreen;

        setGate({
          status: 'ready',
          initialScreen: initialScreenFor(me),
          savedLanguage: me.language,
          welcomeNextScreen,
          consentNextScreen,
        });
      })
      .catch(() => {
        // Without a confirmed account state we show a retry screen instead of guessing a flow:
        // a guess could skip consent or put a woman into a different onboarding.
        if (!cancelled) setGate({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (gate.status === 'loading') {
    return <main className="screen" />;
  }

  if (gate.status === 'error') {
    return <OnboardingNotice title="Не удалось загрузить данные"
      text="Проверьте интернет и попробуйте ещё раз. Если не поможет — закройте и снова откройте приложение из бота."
      actionLabel="Повторить" onAction={() => { setGate({ status: 'loading' }); setAttempt((n) => n + 1); }} />;
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
