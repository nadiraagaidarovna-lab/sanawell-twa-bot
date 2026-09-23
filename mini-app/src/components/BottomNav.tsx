import { useNavigation } from '../lib/useNavigation';
import logoEmblem from '../assets/logo-emblem.png';
import type { ScreenId } from '../lib/navigationContext';

const tabs: { screen: ScreenId; label: string; path?: string }[] = [
  { screen: 'home', label: 'SanaWell' },
  { screen: 'progress', label: 'Динамика', path: 'M4 4v16h16M7 15l4-5 4 3 5-7' },
  { screen: 'partners', label: 'Поддержка', path: 'M12 20s-8-5-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 6-8 11-8 11Z' },
  { screen: 'cabinet', label: 'Профиль', path: 'M15.3 8.5a3.3 3.3 0 1 1-6.6 0 3.3 3.3 0 0 1 6.6 0ZM5.5 20c1-3.6 4-5.4 6.5-5.4s5.5 1.8 6.5 5.4' },
];

// Keep the existing ScreenId stack and destinations; only approved tabs change.
export default function BottomNav({ active }: { active: ScreenId }) {
  const { push } = useNavigation();
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {tabs.map((tab) => (
        <button key={tab.screen} type="button"
          className={`nav-item${active === tab.screen ? ' active' : ''}`}
          aria-current={active === tab.screen ? 'page' : undefined}
          onClick={() => { if (active !== tab.screen) push(tab.screen); }}>
          {tab.screen === 'home' ?
            <img src={logoEmblem} alt="" className="nav-logo" /> :
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={tab.path} />
            </svg>}
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
