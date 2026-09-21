// WelcomeScreen.tsx — Шаг 0 постоянного онбординга (ТЗ v2.12, раздел 6.2.1; Срез О3).
// Заменяет прежний формат этого экрана целиком: раньше — 6 свайп-карточек с текстом
// "Здравствуй, дорогая подруга" (Этап 2, Срез 1), который в v2.12 явно упразднён как
// активный экран продукта (полный старый текст сохранён в ТЗ только "справочно").
// Показ гейтится флагом onboarding_welcome_seen — сама логика "показывать или сразу
// на home" живёт в App.tsx, этот компонент просто рендерит экран, когда его вызвали
// (либо первый раз для новой пользовательницы, либо вручную из настроек HomeScreen).
import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useNavigation } from '../lib/useNavigation';
import { useMainButton } from '../lib/useMainButton';
import { getTelegramLanguageCode } from '../lib/telegram';
import logo from '../assets/sanawell-logo.png';
import type { ScreenId } from '../lib/navigationContext';

type Lang = 'ru' | 'kk';

// Раздел 6.2.1 ТЗ v2.12 — русский текст финальный (дословно, не перефразировать),
// казахский — черновик, требует проверки носителем языка перед публикацией.
const TEXT: Record<
  Lang,
  { title: string; description: string; disclaimer: string; button: string; hint: string }
> = {
  ru: {
    title: 'Твоя опора в переменах после 40',
    description:
      'SanaWell AI помогает понять, что происходит с телом и настроением во время гормональной перестройки — простыми словами, без диагнозов и тревоги. Чек-ин, техники для сна и энергии, забота о себе каждый день.',
    disclaimer:
      'Это не медицинское приложение: оно не заменяет врача, а помогает вовремя к нему обратиться.',
    button: 'Начать',
    hint: 'Язык определён автоматически по Telegram — сменить можно в любой момент.',
  },
  kk: {
    title: '40 жастан кейінгі өзгерістердегі сенімді серігің',
    description:
      'SanaWell AI гормоналдық өзгерістер кезінде денең мен көңіл-күйіңде не болып жатқанын түсінуге көмектеседі — қарапайым тілмен, диагнозсыз және қорқынышсыз. Күнделікті өзін-өзі тексеру, ұйқы мен қуат үшін жаттығулар, өзіңе деген күнделікті қамқорлық.',
    disclaimer:
      'Бұл — медициналық қосымша емес: ол дәрігерді алмастырмайды, керісінше, қажет кезде оған уақытында жүгінуге көмектеседі.',
    button: 'Бастау',
    hint: 'Тілді Telegram бойынша автоматты түрде анықтадық — қажет болса, кез келген уақытта ауыстыра аласың.',
  },
};

// Автоопределение — по language_code из initData (getTelegramLanguageCode), а не из
// window.Telegram.WebApp: скрипт telegram-web-app.js не подключён, и прежний вариант всегда
// возвращал 'ru'. ru/kk — как есть, всё остальное и отсутствие поля — 'ru'.
function detectLanguage(): Lang {
  return getTelegramLanguageCode() ?? 'ru';
}

interface WelcomeScreenProps {
  // Ручной выбор языка (поле language, срез Г) в приоритете над автоопределением —
  // передаётся сверху из App.tsx, у которого он уже есть из того же вызова GET /api/me,
  // которым App.tsx решал, показывать ли вообще этот экран (см. App.tsx).
  savedLanguage: string | null;
  // Срез О2, Промпт 3/4: куда вести по кнопке "Начать" — 'home', если анкета уже
  // пройдена (в т.ч. при ручном повторном показе из настроек HomeScreen), иначе первый
  // экран анкеты. Экран сам не знает и не должен знать про onboarding_anketa_completed —
  // решение приходит сверху, тем же вызовом GET /api/me, что и savedLanguage выше.
  nextScreen: ScreenId;
}

export default function WelcomeScreen({ savedLanguage, nextScreen }: WelcomeScreenProps) {
  const { push } = useNavigation();
  const [lang, setLang] = useState<Lang>(() =>
    savedLanguage === 'ru' || savedLanguage === 'kk' ? savedLanguage : detectLanguage()
  );
  const [submitting, setSubmitting] = useState(false);

  const handleLangChange = (next: Lang) => {
    setLang(next);
    apiFetch('/language', { method: 'POST', body: JSON.stringify({ language: next }) }).catch(() => {
      // Не блокируем UI сетевой ошибкой — тот же паттерн, что и на HomeScreen.
    });
  };

  const handleStart = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Ждём ответ сервера ДО навигации — если Mini App закроют раньше, чем сервер
      // подтвердит, флаг onboarding_welcome_seen не выставится, и без этого ожидания
      // экран показался бы снова при следующем открытии (гонка, явно оговорена в ТЗ).
      await apiFetch('/onboarding-welcome-seen', { method: 'POST' });
    } catch {
      // Сетевая ошибка не должна запирать женщину на этом экране — единственное
      // следствие пропуска шага ниже: экран покажется ещё раз в следующий раз.
    }
    push(nextScreen);
  };

  useMainButton({
    text: TEXT[lang].button,
    onClick: handleStart,
    isEnabled: !submitting,
    isLoaderVisible: submitting,
  });

  const t = TEXT[lang];

  return (
    <main className="screen onboarding-welcome">
      <img src={logo} alt="SanaWell AI" className="onboarding-welcome-logo" />
      <h1>{t.title}</h1>
      <p className="body-text">{t.description}</p>
      <p className="onboarding-welcome-disclaimer">{t.disclaimer}</p>

      <div className="lang-toggle">
        <button
          type="button"
          className={lang === 'ru' ? 'active' : ''}
          onClick={() => handleLangChange('ru')}
        >
          RU
        </button>
        <button
          type="button"
          className={lang === 'kk' ? 'active' : ''}
          onClick={() => handleLangChange('kk')}
        >
          KK
        </button>
      </div>

      <p className="onboarding-welcome-hint">{t.hint}</p>
    </main>
  );
}
