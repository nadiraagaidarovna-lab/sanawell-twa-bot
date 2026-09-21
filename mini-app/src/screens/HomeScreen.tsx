// HomeScreen.tsx — главный экран v2 (Срез Д, Промпт 1/5, ТЗ 4.4.1): сетка из 6
// иллюстрированных папок + нижняя навигация вместо прежнего списка текстовых кнопок и
// блока настроек (блок настроек целиком перенесён в CabinetScreen.tsx, логика не
// переписана). Разметка и SVG-иллюстрации папок скопированы как есть из утверждённого
// Надирой мокапа docs/design/main-screen-reference.html — заменён только статичный мокап
// на реальные интерактивные карточки с onClick-переходами.
//
// Срез «чек-ин на главный экран»: отдельная нативная кнопка «Начать чек-ин» (лишний шаг
// между открытием приложения и основной функцией) убрана — сам чек-ин (CheckinScreen.tsx в
// режиме embedded: сон/настроение/голова + необязательное поле, нативная MainButton
// «Отправить») теперь виден сразу при открытии, а под ним — блок «Мой прогресс»
// (ProgressHook.tsx). Папка «Как ты сегодня» (плитка c1) из сетки убрана — решение Надиры:
// она полностью дублировала встроенный чек-ин выше, своей функции не осталось; в сетке
// теперь 5 плиток (последняя, при нечётном числе, растягивается на обе колонки — см.
// .folder-grid в index.css). Экран 'checkin' (CheckinScreen.tsx) в App.tsx остаётся —
// с главного экрана он больше недостижим, это безвредный мёртвый код до отдельной уборки.
import { useState } from 'react';
import { useNavigation } from '../lib/useNavigation';
import BottomNav from '../components/BottomNav';
import CheckinScreen from './CheckinScreen';
import ProgressHook from '../components/ProgressHook';

export default function HomeScreen() {
  const { push } = useNavigation();
  const [progressRefresh, setProgressRefresh] = useState(0);

  return (
    <main className="screen v2-screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Здравствуйте 🤍</h1>

      <CheckinScreen embedded onSaved={() => setProgressRefresh((n) => n + 1)} />
      <ProgressHook refreshKey={progressRefresh} />

      <div className="folder-grid">
        <button type="button" className="folder-card c2" onClick={() => push('techniques')}>
          <div className="folder-icon">
            <svg viewBox="0 0 120 100" role="img" aria-label="Папка «Мой план поддержки» — иллюстрация гантели и гири">
              <defs>
                <linearGradient id="fg2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#A8B79A" />
                  <stop offset="1" stopColor="#7C8B6F" />
                </linearGradient>
                <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#EFF2E7" />
                  <stop offset="1" stopColor="#D8E0CC" />
                </linearGradient>
              </defs>
              <rect x="14" y="15" width="36" height="13" rx="6" fill="url(#fg2)" />
              <rect x="9" y="23" width="102" height="65" rx="13" fill="url(#fg2)" />
              <path d="M9 61 H111 V78 Q111 88 101 88 H19 Q9 88 9 78 Z" fill="rgba(0,0,0,0.10)" />
              <g transform="rotate(-4 60 55)">
                <rect x="21" y="31" width="78" height="46" rx="8" fill="#fff" opacity="0.92" />
                <rect x="24" y="34" width="72" height="40" rx="6" fill="url(#sg2)" />
                <line x1="42" y1="46" x2="78" y2="46" stroke="#5F6E54" strokeWidth="2.6" strokeLinecap="round" />
                <rect x="34" y="39" width="9" height="14" rx="2.5" fill="#7C8B6F" />
                <rect x="77" y="39" width="9" height="14" rx="2.5" fill="#7C8B6F" />
                <rect x="31" y="41.5" width="4" height="9" rx="1.5" fill="#5F6E54" />
                <rect x="85" y="41.5" width="4" height="9" rx="1.5" fill="#5F6E54" />
                <circle cx="60" cy="66" r="9.5" fill="#7C8B6F" />
                <path
                  d="M53.5 59 Q53.5 51 60 51 Q66.5 51 66.5 59"
                  fill="none"
                  stroke="#5F6E54"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>
            </svg>
          </div>
          <div className="folder-title">Мой план поддержки</div>
          <div className="folder-sub">5 направлений wellness</div>
        </button>

        <button type="button" className="folder-card c3" onClick={() => push('guide')}>
          <div className="folder-icon">
            <svg viewBox="0 0 120 100" role="img" aria-label="Папка «Гид» — иллюстрация компаса">
              <defs>
                <linearGradient id="fg3" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#DCA9A0" />
                  <stop offset="1" stopColor="#C98F86" />
                </linearGradient>
                <linearGradient id="sg3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FBEDE9" />
                  <stop offset="1" stopColor="#EFCFC7" />
                </linearGradient>
              </defs>
              <rect x="14" y="15" width="36" height="13" rx="6" fill="url(#fg3)" />
              <rect x="9" y="23" width="102" height="65" rx="13" fill="url(#fg3)" />
              <path d="M9 61 H111 V78 Q111 88 101 88 H19 Q9 88 9 78 Z" fill="rgba(0,0,0,0.10)" />
              <g transform="rotate(-4 60 55)">
                <rect x="21" y="31" width="78" height="46" rx="8" fill="#fff" opacity="0.92" />
                <rect x="24" y="34" width="72" height="40" rx="6" fill="url(#sg3)" />
                <circle cx="60" cy="55" r="15" fill="#fff" stroke="#C98F86" strokeWidth="2.4" />
                <path d="M60 43 L65 55 L60 67 L55 55 Z" fill="#C98F86" />
                <circle cx="60" cy="55" r="2" fill="#8C5B52" />
                <text x="60" y="41" textAnchor="middle" fontSize="6.5" fontFamily="Karla, sans-serif" fontWeight="700" fill="#8C5B52">
                  N
                </text>
              </g>
            </svg>
          </div>
          <div className="folder-title">Гид</div>
          <div className="folder-sub">о менопаузе простыми словами</div>
        </button>

        <button type="button" className="folder-card c4" onClick={() => push('body')}>
          <div className="folder-icon">
            <svg viewBox="0 0 120 100" role="img" aria-label="Папка «Тело» — иллюстрация силуэта женщины">
              <defs>
                <linearGradient id="fg4" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#B67885" />
                  <stop offset="1" stopColor="#8C4A55" />
                </linearGradient>
                <linearGradient id="sg4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#F3E1E3" />
                  <stop offset="1" stopColor="#E4C3C8" />
                </linearGradient>
              </defs>
              <rect x="14" y="15" width="36" height="13" rx="6" fill="url(#fg4)" />
              <rect x="9" y="23" width="102" height="65" rx="13" fill="url(#fg4)" />
              <path d="M9 61 H111 V78 Q111 88 101 88 H19 Q9 88 9 78 Z" fill="rgba(0,0,0,0.10)" />
              <g transform="rotate(-4 60 55)">
                <rect x="21" y="31" width="78" height="46" rx="8" fill="#fff" opacity="0.92" />
                <rect x="24" y="34" width="72" height="40" rx="6" fill="url(#sg4)" />
                <path
                  d="M52,33 Q39,38 41,52 Q42,61 48,68 L48,71 L41,71 L41,56 Q39,41 51,32 Q53,30.5 52,33 Z"
                  fill="#D9A8AC"
                  opacity="0.6"
                />
                <path
                  d="M62,32 Q71,32 73,40 Q74,44 71,47 Q75,49 76,53 Q80,57 81,65 L81,71 L50,71 L50,60 Q50,52 56,47 Q53,44 54,39 Q56,33 62,32 Z"
                  fill="#8C4A55"
                />
              </g>
            </svg>
          </div>
          <div className="folder-title">Тело</div>
          <div className="folder-sub">интимное здоровье и гигиена</div>
        </button>

        <button type="button" className="folder-card c5" onClick={() => push('partners')}>
          <div className="folder-icon">
            <svg viewBox="0 0 120 100" role="img" aria-label="Папка «Запись к врачу» — иллюстрация календаря">
              <defs>
                <linearGradient id="fg5" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#D9B27E" />
                  <stop offset="1" stopColor="#B98B4E" />
                </linearGradient>
                <linearGradient id="sg5" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FBF1DF" />
                  <stop offset="1" stopColor="#EFDBB2" />
                </linearGradient>
              </defs>
              <rect x="14" y="15" width="36" height="13" rx="6" fill="url(#fg5)" />
              <rect x="9" y="23" width="102" height="65" rx="13" fill="url(#fg5)" />
              <path d="M9 61 H111 V78 Q111 88 101 88 H19 Q9 88 9 78 Z" fill="rgba(0,0,0,0.10)" />
              <g transform="rotate(-4 60 55)">
                <rect x="21" y="31" width="78" height="46" rx="8" fill="#fff" opacity="0.92" />
                <rect x="24" y="34" width="72" height="40" rx="6" fill="url(#sg5)" />
                <rect x="42" y="42" width="36" height="24" rx="4" fill="#fff" stroke="#B98B4E" strokeWidth="2" />
                <line x1="42" y1="50" x2="78" y2="50" stroke="#B98B4E" strokeWidth="2" />
                <line x1="50" y1="38" x2="50" y2="45" stroke="#B98B4E" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="70" y1="38" x2="70" y2="45" stroke="#B98B4E" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="64" cy="58" r="4.4" fill="#B98B4E" />
              </g>
            </svg>
          </div>
          <div className="folder-title">Запись к врачу</div>
          <div className="folder-sub">проверенные специалисты</div>
        </button>

        <button type="button" className="folder-card c6" onClick={() => push('progress')}>
          <div className="folder-icon">
            <svg viewBox="0 0 120 100" role="img" aria-label="Папка «Самочувствие» — иллюстрация растущего графика">
              <defs>
                <linearGradient id="fg6" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#B79AB5" />
                  <stop offset="1" stopColor="#9B7A99" />
                </linearGradient>
                <linearGradient id="sg6" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#F1E7F0" />
                  <stop offset="1" stopColor="#DFC9DE" />
                </linearGradient>
              </defs>
              <rect x="14" y="15" width="36" height="13" rx="6" fill="url(#fg6)" />
              <rect x="9" y="23" width="102" height="65" rx="13" fill="url(#fg6)" />
              <path d="M9 61 H111 V78 Q111 88 101 88 H19 Q9 88 9 78 Z" fill="rgba(0,0,0,0.10)" />
              <g transform="rotate(-4 60 55)">
                <rect x="21" y="31" width="78" height="46" rx="8" fill="#fff" opacity="0.92" />
                <rect x="24" y="34" width="72" height="40" rx="6" fill="url(#sg6)" />
                <line x1="28" y1="68" x2="92" y2="68" stroke="#9B7A99" strokeWidth="1.4" opacity="0.4" />
                <polyline
                  points="30,64 48,54 64,58 84,42"
                  fill="none"
                  stroke="#9B7A99"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="30" cy="64" r="3" fill="#9B7A99" />
                <circle cx="48" cy="54" r="3" fill="#9B7A99" />
                <circle cx="64" cy="58" r="3" fill="#9B7A99" />
                <circle cx="84" cy="42" r="3.6" fill="#7A5D79" />
              </g>
            </svg>
          </div>
          <div className="folder-title">Самочувствие</div>
          <div className="folder-sub">твои графики по неделям</div>
        </button>
      </div>

      <BottomNav active="home" />
    </main>
  );
}
