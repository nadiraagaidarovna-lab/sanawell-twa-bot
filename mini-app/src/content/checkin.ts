export const HOT_FLASHES_LABELS = {
  none: 'Не было', mild: 'Немного', moderate: 'Умеренно', severe: 'Сильно',
} as const;
export type HotFlashes = keyof typeof HOT_FLASHES_LABELS;
