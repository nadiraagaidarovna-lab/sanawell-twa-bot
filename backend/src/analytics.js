// analytics.js — first-party interaction events (backend/migrations/20261007_app_events.sql).
// Accepted only after a current consent (routes.js). Each event has a closed set of fields with
// closed value sets; anything else rejects the whole batch, so answers, symptoms, texts or field
// values can never be stored. The Telegram ID is replaced by a pseudonymous identifier: HMAC of
// the ID with a server secret. That is pseudonymous, not anonymous, data.
const crypto = require('crypto');

const SECTIONS = [
  'home', 'checkin', 'checkin-result', 'progress', 'techniques', 'partners', 'guide', 'body',
  'ai-assistant', 'cabinet', 'profile-edit', 'tariff', 'welcome-again', 'reconsent', 'topics-edit',
];
const DOCS = ['terms', 'privacy', 'dataConsent'];
const ERROR_KINDS = ['network', 'server', 'consent', 'validation'];
const MAX_BATCH = 20;

const isStep = (v) => Number.isInteger(v) && v >= 1 && v <= 7; // 7-screen onboarding
const FIELDS = {
  step: isStep,
  section: (v) => SECTIONS.includes(v),
  errorKind: (v) => ERROR_KINDS.includes(v),
  doc: (v) => DOCS.includes(v),
  seconds: (v) => Number.isInteger(v) && v >= 1 && v <= 3600,
};
// Required fields per event; no other field is allowed.
const EVENTS = {
  onboarding_step_view: ['step'],
  onboarding_step_done: ['step'],
  onboarding_error: ['step', 'errorKind'],
  onboarding_completed: [],
  section_open: ['section'],
  section_active_time: ['section', 'seconds'],
  legal_doc_open: ['doc'],
};

function validateEvent(event) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) return null;
  const { name, ...fields } = event;
  const required = EVENTS[name];
  if (!required) return null;
  const keys = Object.keys(fields);
  if (keys.length !== required.length || !required.every((key) => keys.includes(key))) return null;
  if (!required.every((key) => FIELDS[key](fields[key]))) return null;
  return { name, ...fields };
}

// Explicit ANALYTICS_PSEUDONYM_SECRET, otherwise derived from BOT_TOKEN (already a server-only
// secret). Changing either changes every pseudonym; returns null when no secret is available.
function pseudonymKey() {
  const explicit = process.env.ANALYTICS_PSEUDONYM_SECRET;
  if (explicit) return explicit;
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  return crypto.createHmac('sha256', 'sanawell-analytics-pseudonym-v1').update(token).digest('hex');
}

function pseudonymFor(telegramId, key = pseudonymKey()) {
  if (!key) return null;
  return crypto.createHmac('sha256', key).update(String(telegramId)).digest('hex');
}

module.exports = { EVENTS, SECTIONS, DOCS, ERROR_KINDS, MAX_BATCH, validateEvent, pseudonymFor };
