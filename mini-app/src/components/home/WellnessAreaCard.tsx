// WellnessAreaCard.tsx — одна карточка сетки «6 сфер заботы о себе» (TASK 01, п.12).
// Пока функционирует ТОЛЬКО как навигация/контент — статуса вида "Стабильно"/"Улучшается"
// намеренно нет: данных, чтобы посчитать его достоверно по всем шести направлениям, сейчас
// нет (см. коммент в WellnessGrid.tsx).
import type { ReactNode } from 'react';

interface WellnessAreaCardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
}

export default function WellnessAreaCard({ icon, title, description, onClick }: WellnessAreaCardProps) {
  return (
    <button type="button" className="sw-wellness-card" onClick={onClick}>
      <span className="sw-wellness-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sw-wellness-title">{title}</span>
      {description && <span className="sw-wellness-desc">{description}</span>}
      <svg
        className="sw-wellness-chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}
