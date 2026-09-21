// ProfileEditScreen.tsx — форма редактирования профиля из «Личного кабинета» (Срез Д, Промпт
// 5/5, часть 2, docs/personal-cabinet-v1.md): имя, возраст, email, телефон — все поля
// необязательны. Возраст — свободное числовое поле (users.age), не age_range из анкеты.
// Сохранение — одним POST /api/profile (полная замена значений), затем возврат в кабинет,
// который при монтировании заново читает GET /api/me. Нативная MainButton «Сохранить».
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useMainButton } from '../lib/useMainButton';
import { useNavigation } from '../lib/useNavigation';

interface ProfileMe {
  displayName: string | null;
  age: number | null;
  email: string | null;
  phone: string | null;
}

const AGE_MIN = 18;
const AGE_MAX = 100;

// Те же правила, что в POST /api/profile (routes.js) — чтобы ошибку показать сразу, до запроса.
function validate(age: string, email: string, phone: string): string | null {
  if (age) {
    const n = Number(age);
    if (!Number.isInteger(n) || n < AGE_MIN || n > AGE_MAX) {
      return `Возраст — число от ${AGE_MIN} до ${AGE_MAX}`;
    }
  }
  const emailTrimmed = email.trim();
  if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return 'Проверьте адрес электронной почты';
  }
  const phoneTrimmed = phone.trim();
  if (phoneTrimmed) {
    const digits = phoneTrimmed.replace(/\D/g, '');
    if (!/^\+?[\d\s\-()]+$/.test(phoneTrimmed) || digits.length < 7 || digits.length > 15) {
      return 'Проверьте номер телефона';
    }
  }
  return null;
}

export default function ProfileEditScreen() {
  const { back } = useNavigation();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<ProfileMe>('/me')
      .then((me) => {
        if (cancelled) return;
        setName(me.displayName ?? '');
        setAge(me.age != null ? String(me.age) : '');
        setEmail(me.email ?? '');
        setPhone(me.phone ?? '');
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Сеть недоступна');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (submitting || !loaded) return;

    const problem = validate(age, email, phone);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/profile', {
        method: 'POST',
        body: JSON.stringify({
          displayName: name.trim() || null,
          age: age ? Number(age) : null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      back();
    } catch (e: unknown) {
      // В отличие от переключателей кабинета, здесь ошибку НЕ глотаем: иначе женщина решит,
      // что данные сохранились, а они нет.
      setError(e instanceof ApiError ? 'Не удалось сохранить. Попробуйте ещё раз.' : 'Сеть недоступна. Попробуйте ещё раз.');
      setSubmitting(false);
    }
  }, [submitting, loaded, age, email, phone, name, back]);

  useMainButton({
    text: 'Сохранить',
    onClick: handleSave,
    isEnabled: loaded && !submitting,
    isLoaderVisible: submitting,
  });

  return (
    <main className="screen v2-screen v2-accent-cabinet">
      <p className="eyebrow">SanaWell</p>
      <h1>Профиль</h1>

      {loadError && <p className="cabinet-error">Не удалось загрузить профиль: {loadError}</p>}

      <label className="cabinet-label" htmlFor="profile-name">
        Имя
      </label>
      <input
        id="profile-name"
        className="cabinet-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        disabled={!loaded}
      />

      <label className="cabinet-label" htmlFor="profile-age">
        Возраст
      </label>
      <input
        id="profile-age"
        className="cabinet-input"
        type="text"
        inputMode="numeric"
        value={age}
        // Только цифры: свободный числовой ввод без спиннеров type="number".
        onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
        disabled={!loaded}
      />

      <label className="cabinet-label" htmlFor="profile-email">
        Электронная почта
      </label>
      <input
        id="profile-email"
        className="cabinet-input"
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={254}
        disabled={!loaded}
      />

      <label className="cabinet-label" htmlFor="profile-phone">
        Телефон
      </label>
      <input
        id="profile-phone"
        className="cabinet-input"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={32}
        disabled={!loaded}
      />

      {error && <p className="cabinet-error">{error}</p>}
    </main>
  );
}
