// BottomNav.tsx — нижняя навигация главного экрана v2 (Срез Д, Промпт 1/5, ТЗ 4.4.1):
// 3 пункта, видна поверх любого открытого экрана из группы home/guide/body/ai-assistant/
// cabinet. Разметка и стили — из docs/design/main-screen-reference.html (секция
// "bottom-nav"), адаптированы под реальное приложение: position:fixed вместо
// position:absolute (в референсе — мокап внутри условного "телефона"), плюс безопасная
// зона снизу для физических элементов экрана телефона (index.css, .bottom-nav).
import { useNavigation } from '../lib/useNavigation';
import logoEmblem from '../assets/logo-emblem.png';
import type { ScreenId } from '../lib/navigationContext';

interface BottomNavProps {
  active: ScreenId;
}

export default function BottomNav({ active }: BottomNavProps) {
  const { push } = useNavigation();

  return (
    <nav className="bottom-nav">
      <button
        type="button"
        className={`nav-item${active === 'home' ? ' active' : ''}`}
        onClick={() => push('home')}
      >
        <img src={logoEmblem} alt="" className="nav-logo" />
        <span className="nav-label">Главная</span>
      </button>

      <button
        type="button"
        className={`nav-item${active === 'ai-assistant' ? ' active' : ''}`}
        onClick={() => push('ai-assistant')}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-label="AI ассистент"
        >
          <path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.3-3.6A7.96 7.96 0 0 1 4 12Z" />
          <path d="M9 11h6M9 14h4" />
        </svg>
        <span className="nav-label">AI ассистент</span>
      </button>

      <button
        type="button"
        className={`nav-item${active === 'cabinet' ? ' active' : ''}`}
        onClick={() => push('cabinet')}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-label="Личный кабинет"
        >
          <circle cx="12" cy="8.5" r="3.3" />
          <path d="M5.5 20c1-3.6 4-5.4 6.5-5.4s5.5 1.8 6.5 5.4" />
        </svg>
        <span className="nav-label">Кабинет</span>
      </button>
    </nav>
  );
}
