// content/onboardingV2.ts — texts of the new 7-screen onboarding (Russian only for the first
// launch; existing translations in content/anketa.ts stay untouched).
// Welcome copy: the approved phrases only (headline, three benefits, «Начать знакомство").
// Topics: the six approved wellness areas (docs/sanawell/DECISIONS.md); `homeCard` is the
// existing card title on Home (components/home/WellnessGrid.tsx) where the topic lives.
// Texts marked DRAFT are interface wording added for this release and still need approval.

export const WELCOME = {
  title: 'Вы не одна. И разбираться во всём самой не нужно',
  benefits: ['Понять себя', 'Получить ясные ответы', 'Знать следующие шаги'],
  note: 'SanaWell AI — wellness-сервис. Не ставит диагнозы и не заменяет врача.',
  button: 'Начать знакомство',
} as const;

export const TOPICS = [
  { key: 'nutrition', title: 'Питание и обмен веществ', homeCard: 'Питание' },
  { key: 'movement', title: 'Движение и сила', homeCard: 'Движение' },
  { key: 'sleep', title: 'Сон и восстановление', homeCard: 'Сон' },
  { key: 'menopause360', title: 'Гормональная и интимная гигиена / Менопауза 360°', homeCard: 'Менопауза 360°' },
  { key: 'emotions', title: 'Эмоциональное здоровье', homeCard: 'Эмоции' },
  { key: 'environment', title: 'Окружение и смысл', homeCard: 'Окружение' },
] as const;

export type TopicKey = (typeof TOPICS)[number]['key'];
export const PRIORITY_UNSURE = 'unsure';
export type Priority = TopicKey | typeof PRIORITY_UNSURE;

export function topicTitle(key: string): string {
  return TOPICS.find((topic) => topic.key === key)?.title ?? key;
}

// Screen titles in order (7 screens).
export const TITLES = [
  WELCOME.title,
  'Ваши данные — под вашим контролем',
  'Как к вам обращаться?', // DRAFT
  'Что для вас сейчас важно?', // DRAFT
  'Что для вас главное сейчас?', // DRAFT
  'Проверьте ответы', // DRAFT
  'Ваша стартовая карта', // DRAFT
] as const;

export const TEXT = {
  nameHint: 'Необязательно — можно оставить пустым.', // DRAFT
  namePlaceholder: 'Ваше имя', // DRAFT
  topicsHint: 'Можно выбрать несколько тем.', // DRAFT
  priorityHint: 'Выберите одну тему. Если пока сложно выбрать — так и отметьте.', // DRAFT
  priorityUnsure: 'Пока не знаю',
  reviewName: 'Имя', // DRAFT
  reviewNameEmpty: 'Не указано', // DRAFT
  reviewTopics: 'Темы', // DRAFT
  reviewPriority: 'Главный приоритет', // DRAFT
  edit: 'Изменить',
  reviewButton: 'Всё верно', // DRAFT
  mapFocus: 'Главный фокус', // DRAFT
  mapFocusUnsure: 'Пока не выбран — его можно выбрать позже в профиле.', // DRAFT
  mapTopics: 'Ваши темы', // DRAFT
  mapWhere: (card: string) => `На главной — «${card}»`, // DRAFT
  // Approved earlier for the final onboarding screen.
  mapNext: 'Теперь просто расскажите, как вы сегодня. Это займёт меньше минуты.',
  mapButton: 'Отметить самочувствие →',
} as const;
