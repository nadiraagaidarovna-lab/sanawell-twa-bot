// content/onboardingV2.ts — texts of the new 7-screen onboarding (Russian only for the first
// launch; existing translations in content/anketa.ts stay untouched).
// Welcome copy: approved text, verbatim (06.10.2026).
// Topics: the six approved wellness areas (docs/sanawell/DECISIONS.md); `homeCard` is the
// existing card title on Home (components/home/WellnessGrid.tsx). `found` says what the woman
// actually finds there today (DRAFT); no personal programme is promised where none exists.
// Texts marked DRAFT are interface wording added for this release and still need approval.

export const WELCOME = {
  title: 'Вы не одна. И разбираться во всём самой не нужно',
  subtitle: 'SanaWell мягко сопровождает вас через изменения после 40.',
  benefits: [
    { title: 'Поймёте себя', text: 'Сон, приливы, настроение — что с чем связано.' },
    { title: 'Получите ясные ответы', text: 'На понятном языке, без страшилок.' },
    { title: 'Будете знать, что делать', text: 'Простые шаги и подсказки, когда обратиться к врачу.' },
  ],
  lead: 'Несколько вопросов помогут настроить приложение под вас. Правильных ответов нет.',
  button: 'Начать знакомство',
} as const;

export const TOPICS = [
  { key: 'nutrition', title: 'Питание и обмен веществ', homeCard: 'Питание',
    found: 'Материалы о питании и повседневных пищевых привычках.' },
  { key: 'movement', title: 'Движение и сила', homeCard: 'Движение',
    found: 'Упражнения для женщин 40+: принципы нагрузки, приседания, баланс, плечи — с пояснениями к каждому.' },
  { key: 'sleep', title: 'Сон и восстановление', homeCard: 'Сон',
    found: 'Техники для засыпания: «Окно засыпания», «Темнота и прохлада».' },
  // Short title: no intimate-hygiene materials exist yet. The saved key stays 'menopause360'.
  { key: 'menopause360', title: 'Менопауза 360°', homeCard: 'Менопауза 360°',
    found: 'Гид простыми словами: этапы перименопаузы и менопаузы, что меняется в теле, суставы и плечи.' },
  { key: 'emotions', title: 'Эмоциональное здоровье', homeCard: 'Эмоции',
    found: 'Короткие техники, чтобы успокоиться: дыхание 4-7-8 и заземление «5-4-3-2-1».' },
  { key: 'environment', title: 'Окружение и смысл', homeCard: 'Окружение',
    found: 'Материалы по этой теме ещё готовятся.' },
] as const;

export type TopicKey = (typeof TOPICS)[number]['key'];
// Topics without content yet are selectable but not offered as the main priority. An earlier
// saved priority is kept as is.
export const NOT_OFFERED_AS_PRIORITY: readonly string[] = ['environment'];
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
  mapTopics: 'Ваши темы и что вы найдёте в приложении', // DRAFT
  // Approved earlier for the final onboarding screen.
  mapNext: 'Теперь просто расскажите, как вы сегодня. Это займёт меньше минуты.',
  mapButton: 'Отметить самочувствие →',
} as const;
