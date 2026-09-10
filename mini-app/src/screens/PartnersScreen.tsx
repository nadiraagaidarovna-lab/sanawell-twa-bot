// PartnersScreen.tsx — справочник партнёров на /checkin/ (Срез П2, ТЗ 5.6/6.6/10.5).
// Никакого календаря/API — карточка со ссылкой, переход и бронирование вне приложения,
// вручную. Открываем ссылку через openLink из @telegram-apps/sdk (не window.open — так
// Mini App не закрывается и ссылка открывается штатным способом Telegram), и логируем
// сам факт перехода для метрик конверсии (10.5) — бэкенд не может знать, состоялась ли
// запись на самом деле.
import { useEffect, useState } from 'react';
import { openLink } from '@telegram-apps/sdk';
import { apiFetch, ApiError } from '../lib/api';

interface Partner {
  id: number;
  type: 'doctor' | 'lab';
  specialization: 'gynecologist' | 'nutritionist' | 'endocrinologist' | null;
  name: string;
  formatDescription: string | null;
  linkUrl: string;
  linkType: 'website' | 'whatsapp';
  isPlaceholder: boolean;
}

type ViewState = 'loading' | 'loaded' | 'error';

const GROUP_LABELS: Record<string, string> = {
  gynecologist: 'Гинеколог',
  nutritionist: 'Нутрициолог',
  endocrinologist: 'Эндокринолог',
  lab: 'Лаборатория',
};

const GROUP_ORDER = ['gynecologist', 'nutritionist', 'endocrinologist', 'lab'];

function groupKey(partner: Partner): string {
  return partner.type === 'lab' ? 'lab' : (partner.specialization ?? 'gynecologist');
}

export default function PartnersScreen() {
  const [view, setView] = useState<ViewState>('loading');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ partners: Partner[] }>('/partners')
      .then(({ partners: rows }) => {
        if (cancelled) return;
        setPartners(rows);
        setView('loaded');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'Сеть недоступна');
        setView('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = (partner: Partner) => {
    // Не блокируем открытие ссылки, если лог клика не прошёл по сети — женщина не должна
    // застрять из-за метрики.
    apiFetch(`/partners/${partner.id}/click`, { method: 'POST' }).catch(() => {});

    if (openLink.isAvailable()) {
      openLink(partner.linkUrl);
    } else {
      window.open(partner.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const groups = GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: partners.filter((p) => groupKey(p) === key),
  })).filter((group) => group.items.length > 0);

  return (
    <main className="screen">
      <p className="eyebrow">SanaWell</p>
      <h1>Запись к врачу</h1>
      <p className="body-text">
        Переход и бронирование — на сайте или в WhatsApp партнёра, вне приложения.
      </p>

      {view === 'loading' && (
        <p className="body-text" style={{ color: 'var(--hint)' }}>
          Загружаю…
        </p>
      )}

      {view === 'error' && (
        <p className="body-text" style={{ color: 'var(--sw-terracotta)' }}>
          Не удалось загрузить: {error}
        </p>
      )}

      {view === 'loaded' && groups.length === 0 && (
        <p className="body-text" style={{ color: 'var(--hint)' }}>
          Пока нет партнёров в справочнике.
        </p>
      )}

      {view === 'loaded' &&
        groups.map((group) => (
          <section key={group.key}>
            <p className="module-heading">{group.label}</p>
            <div className="protocol-list">
              {group.items.map((partner) => (
                <div className="protocol-card" key={partner.id}>
                  {partner.isPlaceholder && (
                    <p className="partner-placeholder-badge">
                      Пример — реальный партнёр скоро появится
                    </p>
                  )}
                  <div className="protocol-card-header">
                    <span className="protocol-title">{partner.name}</span>
                  </div>
                  {partner.formatDescription && (
                    <p className="protocol-note" style={{ marginBottom: 12 }}>
                      {partner.formatDescription}
                    </p>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => handleOpen(partner)}>
                    {partner.linkType === 'whatsapp' ? 'Написать в WhatsApp' : 'Открыть сайт'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}
