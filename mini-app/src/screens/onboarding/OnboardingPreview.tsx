import { useState } from 'react';
import { NavigationProvider } from '../../lib/navigation';
import OnboardingFlow from './OnboardingFlow';
import CheckinScreen, { type CheckinRecord } from '../CheckinScreen';
import CheckinResultScreen from '../CheckinResultScreen';
import ProgressScreen from '../ProgressScreen';

// Imported only by the Vite development entry. Never enabled in production.
export default function OnboardingPreview() {
  const [checkin, setCheckin] = useState(false);
  const [result, setResult] = useState<CheckinRecord | null>(null);
  const [progress, setProgress] = useState(false);
  return <NavigationProvider initialScreen="checkin">
    <aside style={{ padding: '12px 20px', fontSize: 16, background: 'var(--sw-primary-soft)' }}>
      Предпросмотр: согласия, имя и возраст сохраняются в вашем аккаунте. Ответы о цикле и МГТ/ГЗТ не сохраняются. Юридические документы — проекты для MVP.
      {checkin && ' Далее — существующий Check-in; его сохранение требует действующей авторизации и API.'}
    </aside>
    {progress ? <><button type="button" onClick={() => setProgress(false)}>← Вернуться к результату</button><ProgressScreen /></>
      : result ? <CheckinResultScreen checkin={result} onDone={() => { setResult(null); setCheckin(false); }} onProgress={() => setProgress(true)} />
      : checkin ? <CheckinScreen onSaved={setResult} />
        : <OnboardingFlow onCheckin={() => setCheckin(true)} />}
  </NavigationProvider>;
}
