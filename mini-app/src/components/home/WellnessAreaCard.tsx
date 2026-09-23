import type { ReactNode } from 'react';

interface WellnessAreaCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

export default function WellnessAreaCard({ icon, title, description, onClick }: WellnessAreaCardProps) {
  return (
    <button type="button" className="sw-wellness-card" onClick={onClick} aria-label={description}>
      <span className="sw-wellness-icon" aria-hidden="true">{icon}</span>
      <span className="sw-wellness-title">{title}</span>
    </button>
  );
}
