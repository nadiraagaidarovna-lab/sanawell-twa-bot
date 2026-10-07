// todayAction.ts — today's single next step (GET/POST /api/today-action, backend/src/dailyAction.js).
// Chosen by the main priority from onboarding or a topic picked for today; check-in scores are not
// used. Opening a material is not «done»: only her own «Попробовала / Пока нет» is recorded.
import { apiFetch } from './api';

export interface TodayMaterial {
  kind: 'technique' | 'guide';
  id: string;
  title: string;
  duration?: string;
  module?: 'sleep' | 'mood' | 'nutrition' | 'strength';
}

export interface TopicOption { key: string; title: string }

export type TodayAction =
  | { needsTopic: true; priority: string | null; options: TopicOption[] }
  | {
      needsTopic: false;
      topic: string;
      topicTitle: string;
      source: 'priority' | 'today';
      reason: string;
      material: TodayMaterial;
      status: 'tried' | 'not_yet' | null;
      priority: string | null;
      options: TopicOption[];
    };

export const loadTodayAction = () => apiFetch<TodayAction>('/today-action');

export const chooseTodayTopic = (topic: string) =>
  apiFetch<TodayAction>('/today-action/topic', { method: 'POST', body: JSON.stringify({ topic }) });

export const markTodayAction = (materialId: string, status: 'tried' | 'not_yet') =>
  apiFetch<TodayAction>('/today-action/status', { method: 'POST', body: JSON.stringify({ materialId, status }) });

// The material screen reads which action it was opened for (one-shot, like guideTarget.ts), so the
// «Попробовала / Пока нет» block appears only when she came from today's action.
let pending: TodayMaterial | null = null;
export function setPendingActionMaterial(material: TodayMaterial): void { pending = material; }
export function peekPendingActionMaterial(): TodayMaterial | null { return pending; }
export function clearPendingActionMaterial(): void { pending = null; }
