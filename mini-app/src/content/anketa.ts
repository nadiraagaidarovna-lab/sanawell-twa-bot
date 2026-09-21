// content/anketa.ts — текст анкеты онбординга, шаги 1-7 (Срез О2, ТЗ v2.13 раздел 6.2.2).
// Русский текст — финальный, взят дословно из ТЗ, не перефразирован. Казахский —
// в основном черновой ПЕРЕВОД САМОГО Claude Code (не из ТЗ): раздел 6.2.2 даёт полный
// казахский текст только для вопроса/пояснения шагов 1-3, для остальных вариантов
// ответа и шагов 4-7 ТЗ содержит лишь пометку "переведено аналогично" без самого
// текста. Решение перевести самостоятельно как черновик подтверждено Надирой
// (15.09.2026) — как и весь остальной казахский контент проекта, требует проверки
// носителем языка перед публикацией в проде.

export type Lang = 'ru' | 'kk';

export interface AnketaOption {
  value: string;
  label: string;
}

// ---- Шаг 1 — Имя ----
export const STEP1_NAME = {
  ru: {
    question: 'Как вас зовут?',
    hint: 'Чтобы обращаться к вам по имени — необязательно настоящее, можно любое, которое вам нравится.',
    placeholder: 'Ваше имя',
  },
  kk: {
    question: 'Атыңыз кім?',
    hint: 'Сізге есіміңізбен жүгіну үшін — міндетті емес, өзіңізге ұнайтын кез келген атты жаза аласыз.',
    placeholder: 'Атыңыз',
  },
} as const;

// ---- Шаг 2 — Возраст ---- свободное числовое поле 18–100 (users.age, POST /api/anketa/age);
// раньше были категории 35–39…60+ (AGE_RANGES/age_range в backend/src/db.js — пока оставлены
// в бэкенде, но экраном больше не используются). Пустое поле = шаг пропущен. Тексты error и
// placeholder добавлены Claude Code, казахский — черновик (проверка носителем языка).
export const STEP2_AGE = {
  ru: {
    question: 'Сколько вам лет?',
    hint: 'Это поможет предлагать техники и советы, которые подходят именно вашему возрасту.',
    placeholder: 'Ваш возраст',
    error: 'Укажите возраст от 18 до 100',
  },
  kk: {
    question: 'Сізге неше жас?',
    hint: 'Бұл сізге дәл сіздің жасыңызға сай тәсілдер мен кеңестер ұсынуға көмектеседі.',
    placeholder: 'Жасыңыз',
    error: 'Жасыңызды 18-ден 100-ге дейін көрсетіңіз',
  },
} as const;

// ---- Шаг 3 — Самоощущаемый этап ---- (значения — SELF_PERCEIVED_STAGES в db.js)
export const STEP3_STAGE: Record<Lang, { question: string; hint: string; options: AnketaOption[] }> = {
  ru: {
    question: 'Как вам кажется, на каком этапе вы сейчас?',
    hint: 'Точного ответа не нужно — ориентируйтесь на свои ощущения.',
    options: [
      { value: 'perimenopause', label: 'Ещё есть цикл, но многое меняется' },
      { value: 'menopause', label: 'Цикла нет уже больше года' },
      { value: 'postmenopause', label: 'Это было довольно давно' },
      { value: 'unsure', label: 'Затрудняюсь сказать' },
    ],
  },
  kk: {
    question: 'Сізге қазір қай кезеңдесіз деп ойлайсыз?',
    hint: 'Дәл жауап қажет емес — өз сезіміңізге сүйеніңіз.',
    options: [
      { value: 'perimenopause', label: 'Циклім әлі бар, бірақ көп нәрсе өзгеруде' },
      { value: 'menopause', label: 'Циклім бір жылдан астам жоқ' },
      { value: 'postmenopause', label: 'Бұл баяғыда болған' },
      { value: 'unsure', label: 'Айту қиын' },
    ],
  },
};

// ---- Шаг 4 — Путь ---- (значения — MENOPAUSE_PATHS в db.js: natural/surgical/oncological;
// "Затрудняюсь ответить" в UI — четвёртый видимый вариант, при выборе которого экран
// отправляет на бэкенд path: 'natural' — техническое решение по умолчанию из ТЗ v2.13,
// не заводим отдельное значение в БД под "unsure" здесь).
export const STEP4_PATH: Record<Lang, { question: string; hint: string; options: AnketaOption[] }> = {
  ru: {
    question: 'С чем связаны эти изменения?',
    hint: 'Это поможет подобрать более подходящие материалы и советы.',
    options: [
      { value: 'natural', label: 'Естественным образом, с возрастом' },
      { value: 'surgical', label: 'После операции (удаление яичников)' },
      { value: 'oncological', label: 'После лечения онкологии' },
      { value: 'unsure', label: 'Затрудняюсь ответить' },
    ],
  },
  kk: {
    question: 'Бұл өзгерістер немен байланысты?',
    hint: 'Бұл сізге қолайлырақ материалдар мен кеңестерді таңдауға көмектеседі.',
    options: [
      { value: 'natural', label: 'Табиғи түрде, жасқа байланысты' },
      { value: 'surgical', label: 'Операциядан кейін (аналық бездерді алып тастау)' },
      { value: 'oncological', label: 'Онкологиялық емдеуден кейін' },
      { value: 'unsure', label: 'Жауап беру қиын' },
    ],
  },
};

// ---- Шаг 5 — Цель ---- (значения — свободный текст в БД, "custom" — служебное значение
// только для UI-логики показа текстового поля, на бэкенд не отправляется как есть).
export const STEP5_GOAL: Record<Lang, { question: string; hint: string; options: AnketaOption[]; customPlaceholder: string }> = {
  ru: {
    question: 'Что для вас сейчас особенно важно?',
    hint: 'Выберите то, что откликается больше всего — так мы покажем нужное в первую очередь.',
    options: [
      { value: 'hot_flashes', label: 'Меньше приливов и потливости' },
      { value: 'sleep', label: 'Наладить сон' },
      { value: 'understand_body', label: 'Разобраться, что происходит с телом' },
      { value: 'confidence', label: 'Чувствовать себя увереннее и спокойнее' },
      { value: 'nutrition_weight', label: 'Наладить питание и вес' },
      { value: 'custom', label: 'Своё' },
    ],
    customPlaceholder: 'Напишите своими словами',
  },
  kk: {
    question: 'Сіз үшін қазір не маңызды?',
    hint: 'Өзіңізге ең жақын келетінін таңдаңыз — солай біз керектісін бірінші кезекте көрсетеміз.',
    options: [
      { value: 'hot_flashes', label: 'Ыстық басу мен терлеуді азайту' },
      { value: 'sleep', label: 'Ұйқыны реттеу' },
      { value: 'understand_body', label: 'Денемде не болып жатқанын түсіну' },
      { value: 'confidence', label: 'Өзімді сенімдірек және тыныш сезіну' },
      { value: 'nutrition_weight', label: 'Тамақтану мен салмақты реттеу' },
      { value: 'custom', label: 'Өзімнің нұсқам' },
    ],
    customPlaceholder: 'Өз сөзіңізбен жазыңыз',
  },
};

// ---- Шаг 6 — Образ жизни ---- (значения — LIFESTYLE_ACTIVITIES/LIFESTYLE_DIETS в db.js;
// стресс — слайдер 1-10, тот же компонент, что в ежедневном чек-ине)
export const STEP6_LIFESTYLE: Record<
  Lang,
  {
    title: string;
    activityQuestion: string;
    activityOptions: AnketaOption[];
    dietQuestion: string;
    dietOptions: AnketaOption[];
    stressQuestion: string;
    stressLowLabel: string;
    stressHighLabel: string;
    skipButton: string;
  }
> = {
  ru: {
    title: 'Это необязательные вопросы — помогут точнее подобрать техники (питание, силовые, дыхательные).',
    activityQuestion: 'Как бы вы описали свою повседневную активность?',
    activityOptions: [
      { value: 'low', label: 'Мало двигаюсь' },
      { value: 'sometimes', label: 'Иногда бывает активность' },
      { value: 'active', label: 'Активна почти каждый день' },
    ],
    dietQuestion: 'Особенности питания есть?',
    dietOptions: [
      { value: 'regular', label: 'Обычное питание' },
      { value: 'vegetarian', label: 'Вегетарианское/растительное' },
      { value: 'lactose_free', label: 'Без лактозы' },
      { value: 'other', label: 'Другое' },
      { value: 'prefer_not_to_say', label: 'Предпочитаю не отвечать' },
    ],
    stressQuestion: 'Как оцениваете уровень стресса в последнее время?',
    stressLowLabel: 'спокойно',
    stressHighLabel: 'очень напряжённо',
    skipButton: 'Пропустить',
  },
  kk: {
    title: 'Бұл міндетті емес сұрақтар — тәсілдерді (тамақтану, күш жаттығулары, тыныс алу) дәлірек таңдауға көмектеседі.',
    activityQuestion: 'Күнделікті белсенділігіңізді қалай сипаттар едіңіз?',
    activityOptions: [
      { value: 'low', label: 'Аз қозғаламын' },
      { value: 'sometimes', label: 'Кейде белсенділік болады' },
      { value: 'active', label: 'Дерлік күн сайын белсендімін' },
    ],
    dietQuestion: 'Тамақтануда ерекшеліктер бар ма?',
    dietOptions: [
      { value: 'regular', label: 'Әдеттегі тамақтану' },
      { value: 'vegetarian', label: 'Вегетариандық/өсімдік тектес' },
      { value: 'lactose_free', label: 'Лактозасыз' },
      { value: 'other', label: 'Басқа' },
      { value: 'prefer_not_to_say', label: 'Айтқым келмейді' },
    ],
    stressQuestion: 'Соңғы кездегі стресс деңгейін қалай бағалайсыз?',
    stressLowLabel: 'тыныш',
    stressHighLabel: 'өте кернеулі',
    skipButton: 'Өткізіп жіберу',
  },
};

// ---- Шаг 7 — Чек-лист симптомов ---- (значения — ключи внутри symptom_checklist JSONB,
// формат { [категория]: string[] } с ключами пунктов ниже, пустые категории не пишутся)
export interface SymptomCategory {
  key: string;
  label: string;
  items: AnketaOption[];
}

export const STEP7_SYMPTOMS: Record<Lang, { title: string; categories: SymptomCategory[] }> = {
  ru: {
    title: 'Что из этого сейчас откликается? Отметьте всё, что подходит — можно пропустить.',
    categories: [
      {
        key: 'hot_flashes',
        label: 'Приливы и жар',
        items: [
          { value: 'hot_flashes', label: 'приливы жара' },
          { value: 'night_sweats', label: 'ночная потливость' },
          { value: 'palpitations', label: 'учащённое сердцебиение' },
        ],
      },
      {
        key: 'mood',
        label: 'Настроение',
        items: [
          { value: 'irritability', label: 'раздражительность' },
          { value: 'mood_swings', label: 'перепады настроения' },
          { value: 'anxiety', label: 'тревожность' },
          // Пункт "депрессивные мысли" оставлен по формулировке черновика прямым решением
          // Надиры (15.09.2026) несмотря на близость к теме психического здоровья — не
          // запускает safety-сценарий раздела 5.8/6.10 напрямую (простой чекбокс, не
          // свободный текст), но ТРЕБУЕТ REVIEW ГИНЕКОЛОГОМ-СОУЧРЕДИТЕЛЕМ перед публикацией
          // в проде, как и весь клинически звучащий контент продукта (ТЗ v2.13, 6.2.2).
          { value: 'depressive_thoughts', label: 'депрессивные мысли' },
        ],
      },
      {
        key: 'head',
        label: 'Голова',
        items: [
          { value: 'brain_fog', label: 'туман в голове, трудно сосредоточиться' },
          { value: 'distractibility', label: 'рассеянность' },
        ],
      },
      {
        key: 'body',
        label: 'Тело',
        items: [
          { value: 'joint_muscle_pain', label: 'боли в суставах и мышцах' },
          { value: 'dry_skin', label: 'сухость кожи' },
          { value: 'weight_changes', label: 'изменения веса' },
          { value: 'headaches', label: 'головные боли' },
        ],
      },
      {
        key: 'sleep',
        label: 'Сон',
        items: [
          { value: 'trouble_falling_asleep', label: 'трудности с засыпанием' },
          { value: 'frequent_waking', label: 'частые пробуждения' },
          { value: 'insomnia', label: 'бессонница' },
        ],
      },
      {
        key: 'intimacy',
        label: 'Близость',
        items: [
          { value: 'low_libido', label: 'снижение желания' },
          { value: 'discomfort', label: 'дискомфорт' },
        ],
      },
    ],
  },
  kk: {
    title: 'Осылардың қайсысы қазір сізге сай келеді? Сәйкес келетіннің бәрін белгілеңіз — өткізіп жіберуге болады.',
    categories: [
      {
        key: 'hot_flashes',
        label: 'Ыстық басу',
        items: [
          { value: 'hot_flashes', label: 'ыстық басу' },
          { value: 'night_sweats', label: 'түнгі терлеу' },
          { value: 'palpitations', label: 'жүрек соғысының жиілеуі' },
        ],
      },
      {
        key: 'mood',
        label: 'Көңіл-күй',
        items: [
          { value: 'irritability', label: 'тітіркену' },
          { value: 'mood_swings', label: 'көңіл-күйдің құбылуы' },
          { value: 'anxiety', label: 'мазасыздық' },
          // См. комментарий у RU-версии этого пункта выше — то же ограничение (review
          // гинекологом-соучредителем перед публикацией) относится и к этому переводу.
          { value: 'depressive_thoughts', label: 'депрессиялық ойлар' },
        ],
      },
      {
        key: 'head',
        label: 'Бас',
        items: [
          { value: 'brain_fog', label: 'бас айналуы, зейін қою қиын' },
          { value: 'distractibility', label: 'алаңдаушылық' },
        ],
      },
      {
        key: 'body',
        label: 'Дене',
        items: [
          { value: 'joint_muscle_pain', label: 'буын мен бұлшықет ауруы' },
          { value: 'dry_skin', label: 'терінің құрғауы' },
          { value: 'weight_changes', label: 'салмақтың өзгеруі' },
          { value: 'headaches', label: 'бас ауруы' },
        ],
      },
      {
        key: 'sleep',
        label: 'Ұйқы',
        items: [
          { value: 'trouble_falling_asleep', label: 'ұйықтауда қиындық' },
          { value: 'frequent_waking', label: 'жиі оянулар' },
          { value: 'insomnia', label: 'ұйқысыздық' },
        ],
      },
      {
        key: 'intimacy',
        label: 'Жақындық',
        items: [
          { value: 'low_libido', label: 'тілектің төмендеуі' },
          { value: 'discomfort', label: 'қолайсыздық' },
        ],
      },
    ],
  },
};

// Общие подписи кнопок, переиспользуются на всех 7 экранах.
export const ANKETA_COMMON = {
  ru: { next: 'Далее', skip: 'Пропустить' },
  kk: { next: 'Келесі', skip: 'Өткізіп жіберу' },
} as const;
