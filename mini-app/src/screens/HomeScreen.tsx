// HomeScreen.tsx — корневой экран Mini App. "Начать чек-ин" — через нативный MainButton
// (ТЗ 4.1), а не кастомную кнопку. Реальный чек-ин появится на Срезе 3.
import { useNavigation } from '../lib/useNavigation';
import { useMainButton } from '../lib/useMainButton';

export default function HomeScreen() {
  const { push } = useNavigation();

  useMainButton({
    text: 'Начать чек-ин',
    onClick: () => push('checkin'),
  });

  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Как вы сегодня?</h1>
      <p className="body-text">Нажмите «Начать чек-ин» внизу экрана.</p>
    </main>
  );
}
