// app.js — логика Web App: язык → онбординг → трекер → протоколы/прогресс,
// без сборщиков и фреймворков. Тексты — из i18n.js (ТЗ, Модуль 5).

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

const INIT_DATA = tg?.initData || '';
const LANG_STORAGE_KEY = 'sanawell_lang';

let currentLang = 'ru';
let currentModule = null;

// --- Навигация между экранами ---
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// --- Обёртка над fetch с заголовком авторизации Telegram ---
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': INIT_DATA,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.reason || `HTTP ${res.status}`);
  }
  return res.json();
}

// ================= i18n: применение переводов к статичным элементам =================
function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = i18nGet(currentLang, el.dataset.i18n);
    if (typeof value === 'string') el.textContent = value;
  });
  document.getElementById('detail-freetext').placeholder = i18nGet(currentLang, 'detail.freetextPlaceholder');
}

function setLanguage(lang, { persist = true } = {}) {
  currentLang = lang === 'kk' ? 'kk' : 'ru';
  try {
    localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  } catch (e) {
    // приватный режим / недоступен localStorage — не критично, язык всё равно передан на сервер
  }
  applyStaticTranslations();
  if (persist) {
    api('/language', { method: 'POST', body: { language: currentLang } }).catch((e) =>
      console.warn('Не удалось сохранить язык на сервере:', e.message)
    );
  }
}

// ================= ЭКРАН 0: выбор языка =================
document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);
    // Если пользователь меняет язык с экрана "Мой путь" — остаёмся там,
    // иначе (первый выбор) переходим к следующему шагу онбординга/трекера.
    if (!document.getElementById('screen-progress').classList.contains('hidden')) {
      if (lastProgressData) renderProgressGrid(lastProgressData.dates, lastProgressData.grid);
      return;
    }
    proceedAfterLanguage();
  });
});

async function proceedAfterLanguage() {
  try {
    const me = await api('/me');
    if (me.onboarded) {
      showScreen('screen-tracker');
    } else {
      showScreen('screen-onboarding');
    }
  } catch (e) {
    console.warn('Не удалось получить статус пользователя:', e.message);
    showScreen('screen-onboarding');
  }
}

// ================= ЭКРАН 1: онбординг =================
const consentCheckbox = document.getElementById('consent-checkbox');
const reminderCheckbox = document.getElementById('reminder-checkbox');
const btnEnter = document.getElementById('btn-enter');

consentCheckbox.addEventListener('change', () => {
  btnEnter.disabled = !consentCheckbox.checked;
});

btnEnter.addEventListener('click', async () => {
  try {
    await api('/consent', { method: 'POST', body: { reminderOptIn: reminderCheckbox.checked } });
  } catch (e) {
    console.warn('Не удалось сохранить согласие:', e.message);
    // Не блокируем пользователя из-за сетевой ошибки — она не критична для UX онбординга
  }
  showScreen('screen-tracker');
});

// ================= ЭКРАН 2: трекер (три кнопки) =================
document.querySelectorAll('.tracker-tile').forEach((tile) => {
  tile.addEventListener('click', () => openModuleDetail(tile.dataset.module));
});

document.getElementById('btn-show-all-protocols').addEventListener('click', async () => {
  try {
    const { protocols } = await api('/protocols');
    const ids = Object.values(protocols).flat().map((p) => p.id);
    renderProtocolsList(ids, i18nGet(currentLang, 'protocols.allTitle'));
    showScreen('screen-protocols');
  } catch (e) {
    alert('Не получилось загрузить техники. Попробуйте ещё раз.');
  }
});

document.getElementById('btn-show-progress').addEventListener('click', () => openProgressScreen());

// ================= ЭКРАН 2b: детали модуля =================
function openModuleDetail(moduleName) {
  currentModule = moduleName;
  const detail = i18nGet(currentLang, 'detail');

  document.getElementById('detail-title').textContent = detail.titles[moduleName];
  document.getElementById('detail-freetext').value = '';

  const optionsWrap = document.getElementById('detail-options');
  optionsWrap.innerHTML = '';
  detail.options[moduleName].forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-chip';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => submitTrackerEntry(moduleName, opt.value));
    optionsWrap.appendChild(btn);
  });

  showScreen('screen-detail');
}

async function submitTrackerEntry(moduleName, value) {
  const freeText = document.getElementById('detail-freetext').value.trim();

  // Если пользователь что-то написал свободным текстом — сначала проверяем маркеры риска.
  // Детектор на бэкенде проверяет казахские и русские маркеры одновременно (ТЗ 5.4).
  if (freeText) {
    try {
      const safety = await api('/safety-check', { method: 'POST', body: { text: freeText } });
      if (safety.risk) {
        renderSafetyScreen();
        return;
      }
    } catch (e) {
      console.warn('safety-check не выполнен:', e.message);
      // продолжаем — лучше показать протоколы, чем заблокировать пользователя из-за сети
    }
  }

  try {
    const { protocols } = await api('/track', { method: 'POST', body: { module: moduleName, value } });
    renderProtocolsList(
      protocols.map((p) => p.id),
      i18nGet(currentLang, 'protocols.defaultTitle')
    );
    showScreen('screen-protocols');
  } catch (e) {
    alert('Не получилось сохранить отметку. Попробуйте ещё раз.');
  }
}

// ================= ЭКРАН 3: протоколы =================
// Контент протоколов рендерится из локального i18n-словаря по id (бэкенд — источник
// правды по id/логике, перевод текста — на фронтенде, чтобы смена языка не требовала
// нового запроса и не дублировала контент на сервере для каждого языка).
function renderProtocolsList(protocolIds, title) {
  document.getElementById('protocols-title').textContent = title;
  const list = document.getElementById('protocols-list');
  list.innerHTML = '';

  const byId = i18nGet(currentLang, 'protocols.byId');

  if (!protocolIds.length) {
    list.innerHTML = `<p class="body-text">${i18nGet(currentLang, 'protocols.emptyHint')}</p>`;
    return;
  }

  protocolIds.forEach((id) => {
    const p = byId[id];
    if (!p) return;
    const card = document.createElement('div');
    card.className = 'protocol-card';
    card.innerHTML = `
      <span class="p-title">${p.title}</span>
      <span class="p-duration">${p.duration}</span>
      <ol>${p.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
      <p class="p-note">${p.note}</p>
    `;
    list.appendChild(card);
  });
}

// ================= ЭКРАН 4: безопасность =================
function renderSafetyScreen() {
  const safety = i18nGet(currentLang, 'safety');
  document.getElementById('safety-message').textContent = safety.message;
  const resWrap = document.getElementById('safety-resources');
  resWrap.innerHTML = '';
  safety.resources.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'safety-resource-item';
    item.innerHTML = `<strong>${r.label}</strong>${r.value}`;
    resWrap.appendChild(item);
  });
  showScreen('screen-safety');
}

// ================= ЭКРАН 5: "Мой путь" (прогресс, напоминания, смена языка) =================
const reminderToggle = document.getElementById('reminder-toggle');
let reminderToggleWired = false;
let lastProgressData = null;

async function openProgressScreen() {
  showScreen('screen-progress');
  applyStaticTranslations();

  try {
    const me = await api('/me');
    reminderToggle.checked = !!me.reminderOptIn;
  } catch (e) {
    console.warn('Не удалось получить настройки напоминаний:', e.message);
  }

  if (!reminderToggleWired) {
    reminderToggle.addEventListener('change', async () => {
      try {
        await api('/reminder-opt-in', { method: 'POST', body: { optIn: reminderToggle.checked } });
      } catch (e) {
        console.warn('Не удалось сохранить настройку напоминаний:', e.message);
      }
    });
    reminderToggleWired = true;
  }

  try {
    const { dates, grid } = await api('/progress?days=14');
    lastProgressData = { dates, grid };
    renderProgressGrid(dates, grid);
  } catch (e) {
    console.warn('Не удалось загрузить прогресс:', e.message);
  }
}

function renderProgressGrid(dates, grid) {
  const modules = ['sleep', 'mood', 'cognitive'];
  const labels = i18nGet(currentLang, 'progress.moduleLabels');
  const hasAnyMark = modules.some((m) => grid[m].some((v) => v === 1));

  document.getElementById('progress-empty-hint').classList.toggle('hidden', hasAnyMark);

  const wrap = document.getElementById('progress-grid');
  wrap.innerHTML = '';

  modules.forEach((moduleName) => {
    const row = document.createElement('div');
    row.className = 'progress-row';

    const label = document.createElement('span');
    label.className = 'progress-row-label';
    label.textContent = labels[moduleName];
    row.appendChild(label);

    const cells = document.createElement('div');
    cells.className = 'progress-cells';
    grid[moduleName].forEach((marked, i) => {
      const cell = document.createElement('span');
      cell.className = 'progress-cell' + (marked ? ' marked' : '');
      cell.title = dates[i];
      cells.appendChild(cell);
    });
    row.appendChild(cells);

    wrap.appendChild(row);
  });
}

// ================= Кнопки "Назад" =================
document.querySelectorAll('[data-back-to]').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(`screen-${btn.dataset.backTo}`));
});

// ================= Точка входа =================
async function init() {
  let storedLang = null;
  try {
    storedLang = localStorage.getItem(LANG_STORAGE_KEY);
  } catch (e) {
    // недоступен localStorage — не критично, пойдём через сервер/экран выбора
  }

  let me = null;
  try {
    me = await api('/me');
  } catch (e) {
    console.warn('Не удалось получить статус пользователя:', e.message);
  }

  const serverLang = me && me.language;

  if (serverLang) {
    setLanguage(serverLang, { persist: false });
  } else if (storedLang) {
    setLanguage(storedLang);
  } else {
    // Совсем новый пользователь: экран выбора языка идёт первым (ТЗ 5.1).
    applyStaticTranslations();
    showScreen('screen-language');
    return;
  }

  if (me && me.onboarded) {
    showScreen('screen-tracker');
  } else {
    showScreen('screen-onboarding');
  }
}

init();
