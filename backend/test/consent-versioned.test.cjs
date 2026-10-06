// Isolated PostgreSQL/WASM only. No dotenv, real pg connection, or user data.
// SANAWELL_TEST_PGLITE_PATH=<installed @electric-sql/pglite> node --test backend/test/consent-versioned.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { PGlite } = require(process.env.SANAWELL_TEST_PGLITE_PATH || '@electric-sql/pglite');
const src = path.resolve(__dirname, '../src');
const consentMigration = fs.readFileSync(path.resolve(__dirname, '../migrations/20261006_consent_events.sql'), 'utf8');
const profileSourceMigration = fs.readFileSync(path.resolve(__dirname, '../migrations/20261007_consent_events_profile_source.sql'), 'utf8');
const cycleMigration = fs.readFileSync(path.resolve(__dirname, '../migrations/20260923_onboarding_cycle_mht.sql'), 'utf8');
const TOKEN = 'consent-isolated-test-token';
function load(file, overrides = {}) {
  const filename = path.join(src, file), nativeRequire = createRequire(filename), module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })(
    name => overrides[name] || nativeRequire(name), module, module.exports);
  return module.exports;
}
function auth(id) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id }) });
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const data = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  params.set('hash', crypto.createHmac('sha256', secret).update(data).digest('hex'));
  return params.toString();
}
async function setup(env = {}) {
  const pg = new PGlite();
  class TestPool {
    query(sql, params) { return params ? pg.query(sql, params) : pg.exec(sql).then(r => r[r.length - 1]); }
    connect() { return Promise.resolve({ query: (sql, params) => this.query(sql, params), release() {} }); }
  }
  const db = load('db.js', { pg: { Pool: TestPool } });
  await db.initSchema();
  await pg.exec(cycleMigration);
  await pg.exec(consentMigration);
  await pg.exec(profileSourceMigration);
  await pg.exec(fs.readFileSync(path.resolve(__dirname, '../migrations/20261007_app_events.sql'), 'utf8'));
  await pg.exec(fs.readFileSync(path.resolve(__dirname, '../migrations/20261008_onboarding_topics.sql'), 'utf8'));
  await pg.exec(fs.readFileSync(path.resolve(__dirname, '../migrations/20261009_onboarding_reached_step.sql'), 'utf8'));
  const saved = {};
  for (const [key, value] of Object.entries(env)) { saved[key] = process.env[key]; process.env[key] = value; }
  const { buildRouter } = load('routes.js', { './db': db });
  const { requireTelegramAuth } = load('telegramAuth.js');
  const express = createRequire(path.join(src, 'routes.js'))('express');
  const app = express();
  app.use(express.json());
  app.use('/api', buildRouter({ requireAuth: requireTelegramAuth(TOKEN) })); // reads env here
  for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(route, body, id = 101) {
    const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': auth(id) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  const close = async () => { await new Promise(resolve => server.close(resolve)); await pg.close(); };
  return { pg, db, request, close };
}
const { CURRENT_VERSION, REQUIRED_DOCUMENTS } = load('consent.js');
const legal = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../mini-app/src/lib/legal-documents.json'), 'utf8'));
const GRANT = { version: CURRENT_VERSION, documents: REQUIRED_DOCUMENTS };

const WRITES = [
  ['/profile', { displayName: 'Тест' }],
  ['/menopause-path', { path: 'natural' }],
  ['/anketa/name', { displayName: 'Тест' }],
  ['/anketa/age-range', { ageRange: '45_49' }],
  ['/anketa/age', { age: 47 }],
  ['/anketa/cycle-situation', { cycleSituation: 'unsure' }],
  ['/anketa/mht-status', { mhtStatus: 'prefer_not_to_say' }],
  ['/anketa/self-perceived-stage', { stage: 'unsure' }],
  ['/anketa/goal', { goal: 'Наладить сон', goalKey: 'sleep' }],
  ['/anketa/lifestyle', { activity: 'low' }],
  ['/anketa/symptoms', { checklist: { sleep: ['insomnia'] } }],
  ['/anketa/complete', {}],
  ['/checkin', { sleep: 5, mood: 5, memory: 5 }],
  ['/partners/1/click', {}], // stores telegram_id
  ['/anketa/topics', { topics: ['sleep'] }],
  ['/anketa/priority', { priority: 'unsure' }],
  ['/anketa/progress', { step: 4 }],
];

test('version comes from the single legal-documents source', () => {
  assert.equal(CURRENT_VERSION, legal.version);
  assert.deepEqual([...REQUIRED_DOCUMENTS].sort(), ['privacy_data_consent', 'terms']);
});

test('every write of personal or wellbeing data is rejected without consent and creates nothing', async () => {
  const { pg, request, close } = await setup();
  try {
    for (const [route, body] of WRITES) {
      const result = await request(route, body);
      assert.equal(result.status, 403, route);
      assert.equal(result.body.error, 'consent_required', route);
    }
    assert.equal((await pg.query('SELECT count(*)::int n FROM users')).rows[0].n, 0);
    assert.equal((await pg.query('SELECT count(*)::int n FROM daily_checkins')).rows[0].n, 0);
    assert.equal((await pg.query('SELECT count(*)::int n FROM partner_clicks')).rows[0].n, 0);
    assert.equal((await request('/partners')).status, 200); // the directory itself stays readable
    // Non-data endpoints keep working without consent.
    assert.equal((await request('/me')).status, 200);
    assert.equal((await request('/language', { language: 'ru' })).status, 200);
    assert.equal((await request('/reminder-opt-in', { optIn: false })).status, 200);
    assert.equal((await request('/account/delete-request', {})).status, 200);
  } finally { await close(); }
});

test('confirmation is validated, versioned, append-only and not duplicated', async () => {
  const { pg, db, request, close } = await setup();
  try {
    for (const body of [{}, { version: CURRENT_VERSION }, { version: CURRENT_VERSION, documents: ['terms'] },
      { version: CURRENT_VERSION, documents: [...REQUIRED_DOCUMENTS, 'marketing'] }, { ...GRANT, source: 'other' }, { ...GRANT, version: 5 }]) {
      assert.equal((await request('/consents', body)).status, 400, JSON.stringify(body));
    }
    const stale = await request('/consents', { ...GRANT, version: '2020-01-01-old' });
    assert.equal(stale.status, 409); assert.equal(stale.body.version, CURRENT_VERSION);
    assert.equal((await pg.query('SELECT count(*)::int n FROM consent_events')).rows[0].n, 0);

    let me = (await request('/me')).body;
    assert.deepEqual(me.consents, { version: CURRENT_VERSION, terms: false, privacyDataConsent: false, current: false });
    const granted = await request('/consents', GRANT);
    assert.equal(granted.status, 200); assert.equal(granted.body.current, true); assert.equal(granted.body.version, CURRENT_VERSION);
    assert.equal((await request('/consents', GRANT)).status, 200); // retry after a lost response
    const rows = (await pg.query('SELECT document, document_version, action, source FROM consent_events ORDER BY document')).rows;
    assert.deepEqual(rows, [
      { document: 'privacy_data_consent', document_version: CURRENT_VERSION, action: 'granted', source: 'onboarding_v2' },
      { document: 'terms', document_version: CURRENT_VERSION, action: 'granted', source: 'onboarding_v2' },
    ]);
    me = (await request('/me')).body;
    assert.equal(me.consents.current, true);
    assert.equal(me.dataStorageConsented, true); assert.equal(me.medicalDisclaimerConsented, true);
    await assert.rejects(pg.query("UPDATE consent_events SET action='withdrawn'"));

    for (const [route, body] of WRITES) assert.equal((await request(route, body)).status, 200, route);

    // A newer document version makes the old confirmation insufficient; answers stay.
    await pg.query("INSERT INTO consent_events (telegram_id, document, document_version, action, source) VALUES ('101','terms',$1,'withdrawn','reconsent')", [CURRENT_VERSION]);
    assert.equal((await request('/me')).body.consents.current, false);
    assert.equal((await request('/anketa/age', { age: 50 })).status, 403);
    assert.equal((await db.getUser('101')).age, 47);
    assert.equal((await request('/consents', { ...GRANT, source: 'reconsent' })).status, 200);
    assert.equal((await request('/anketa/age', { age: 50 })).status, 200);
  } finally { await close(); }
});

test('legacy timestamps are kept and never count as current consent', async () => {
  const { pg, request, close } = await setup();
  try {
    await pg.query("INSERT INTO users (telegram_id, medical_disclaimer_consent_at, data_storage_consent_at, onboarding_anketa_completed, display_name) VALUES ('101','2026-09-01T00:00:00.000Z','2026-09-02T00:00:00.000Z',true,'Старое имя')");
    const me = (await request('/me')).body;
    assert.equal(me.consents.current, false); assert.equal(me.onboardingAnketaCompleted, true);
    assert.equal((await request('/consents', { ...GRANT, source: 'reconsent' })).status, 200);
    const row = (await pg.query("SELECT medical_disclaimer_consent_at, data_storage_consent_at, onboarding_anketa_completed, display_name FROM users WHERE telegram_id='101'")).rows[0];
    assert.deepEqual(row, { medical_disclaimer_consent_at: '2026-09-01T00:00:00.000Z', data_storage_consent_at: '2026-09-02T00:00:00.000Z', onboarding_anketa_completed: true, display_name: 'Старое имя' });
  } finally { await close(); }
});

test('missing journal table fails closed', async () => {
  const pg = new PGlite();
  try {
    class TestPool {
      query(sql, params) { return params ? pg.query(sql, params) : pg.exec(sql).then(r => r[r.length - 1]); }
      connect() { return Promise.resolve({ query: (sql, params) => this.query(sql, params), release() {} }); }
    }
    const db = load('db.js', { pg: { Pool: TestPool } });
    await db.initSchema();
    const { buildRouter } = load('routes.js', { './db': db });
    const { requireTelegramAuth } = load('telegramAuth.js');
    const express = createRequire(path.join(src, 'routes.js'))('express');
    const app = express(); app.use(express.json());
    app.use('/api', buildRouter({ requireAuth: requireTelegramAuth(TOKEN) }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    try {
      const base = `http://127.0.0.1:${server.address().port}/api`;
      const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': auth(101) }, body: JSON.stringify(body) });
      assert.equal((await post('/anketa/age', { age: 47 })).status, 503);
      assert.equal((await post('/consents', GRANT)).status, 503);
      const me = await (await fetch(base + '/me', { headers: { 'X-Telegram-Init-Data': auth(101) } })).json();
      assert.equal(me.consents.current, false);
      assert.equal((await pg.query('SELECT count(*)::int n FROM users')).rows[0].n, 0);
    } finally { await new Promise(resolve => server.close(resolve)); }
  } finally { await pg.close(); }
});

test('onboarding version is decided by the server for the regular bot button', async () => {
  for (const [mode, testers, expected] of [
    [undefined, '', { 101: 'legacy', 202: 'legacy' }],
    [undefined, '101', { 101: 'v2', 202: 'legacy' }],
    ['v2_allowlist', '101', { 101: 'v2', 202: 'legacy' }],
    ['v2_all', '', { 101: 'v2', 202: 'v2' }],
    ['paused', '101', { 101: 'paused', 202: 'paused' }],
    ['legacy', '101', { 101: 'v2', 202: 'legacy' }], // unknown value -> v2_allowlist
  ]) {
    const env = { ONBOARDING_TESTER_IDS: testers };
    if (mode !== undefined) env.ONBOARDING_VERSION_MODE = mode;
    const { request, close } = await setup(env);
    try {
      for (const [id, version] of Object.entries(expected)) {
        assert.equal((await request('/me', undefined, Number(id))).body.onboardingVersion, version, `${mode} ${id}`);
      }
    } finally { await close(); }
  }
});

test('withdrawal blocks new writes, keeps documents, own data and the deletion request', async () => {
  const { pg, db, request, close } = await setup();
  try {
    assert.equal((await request('/consents/withdraw', {})).status, 200); // nothing to withdraw yet
    assert.equal((await pg.query('SELECT count(*)::int n FROM consent_events')).rows[0].n, 0);
    assert.equal((await request('/consents', GRANT)).status, 200);
    assert.equal((await request('/anketa/age', { age: 47 })).status, 200);
    assert.equal((await request('/reminder-opt-in', { optIn: true })).status, 200);
    assert.equal((await request('/habits-reminder-opt-in', { optIn: true })).status, 200);

    const withdrawn = await request('/consents/withdraw', {});
    assert.equal(withdrawn.status, 200);
    assert.deepEqual({ current: withdrawn.body.current, terms: withdrawn.body.terms, privacy: withdrawn.body.privacyDataConsent }, { current: false, terms: false, privacy: false });
    const rows = (await pg.query("SELECT document, action, source, document_version FROM consent_events WHERE action='withdrawn' ORDER BY document")).rows;
    assert.deepEqual(rows.map(r => [r.document, r.source, r.document_version]), [['privacy_data_consent', 'profile', CURRENT_VERSION], ['terms', 'profile', CURRENT_VERSION]]);
    const user = await db.getUser('101');
    assert.equal(user.reminder_opt_in, 0); assert.equal(user.habits_reminder_opt_in, 0);
    assert.equal(user.age, 47); // saved data is kept until a deletion request

    for (const [route, body] of WRITES) assert.equal((await request(route, body)).status, 403, route);
    assert.equal((await request('/reminder-opt-in', { optIn: true })).status, 403); // enabling needs consent
    assert.equal((await request('/reminder-opt-in', { optIn: false })).status, 200); // disabling always works
    assert.equal((await request('/me')).status, 200);
    assert.equal((await request('/checkin/history?days=7')).status, 200);
    assert.equal((await request('/account/delete-request', {})).status, 200);
    assert.equal((await request('/account/cancel-deletion', {})).status, 200);
    assert.equal((await request('/consents/withdraw', {})).status, 200); // idempotent
    assert.equal((await pg.query("SELECT count(*)::int n FROM consent_events WHERE action='withdrawn'")).rows[0].n, 2);

    assert.equal((await request('/consents', { ...GRANT, source: 'reconsent' })).status, 200);
    assert.equal((await request('/anketa/age', { age: 48 })).status, 200);
    assert.equal((await db.getUser('101')).reminder_opt_in, 0); // not silently re-enabled
  } finally { await close(); }
});

test('analytics: only after consent, closed whitelist, pseudonymous identifier, no values', async () => {
  const savedToken = process.env.BOT_TOKEN; process.env.BOT_TOKEN = TOKEN;
  const { pg, request, close } = await setup();
  try {
    const good = [
      { name: 'onboarding_step_view', step: 3 }, { name: 'onboarding_step_done', step: 3 },
      { name: 'onboarding_error', step: 4, errorKind: 'network' }, { name: 'onboarding_completed' },
      { name: 'section_open', section: 'home' }, { name: 'section_active_time', section: 'guide', seconds: 42 },
      { name: 'legal_doc_open', doc: 'privacy' },
    ];
    assert.equal((await request('/events', { events: good })).status, 403); // before consent
    assert.equal((await pg.query('SELECT count(*)::int n FROM app_events')).rows[0].n, 0);
    assert.equal((await request('/consents', GRANT)).status, 200);
    for (const bad of [
      { name: 'onboarding_step_view', step: 3, answer: 'regular' },     // extra field
      { name: 'onboarding_step_done', step: 3, value: 49 },
      { name: 'section_open', section: 'home', text: 'мне плохо' },
      { name: 'section_open', section: 'anketa-symptoms' },             // not a section
      { name: 'section_active_time', section: 'home', seconds: 0 },
      { name: 'section_active_time', section: 'home', seconds: 3601 },
      { name: 'section_active_time', section: 'home', seconds: 1.5 },
      { name: 'onboarding_step_view', step: 8 },           // 7 screens
      { name: 'onboarding_error', step: 2, errorKind: 'Не удалось' },
      { name: 'legal_doc_open', doc: 'https://example.com' },
      { name: 'checkin_saved', sleep: 5 },                              // unknown event
      { name: 'onboarding_completed', step: 6 },
    ]) {
      assert.equal((await request('/events', { events: [good[0], bad] })).status, 400, JSON.stringify(bad));
    }
    assert.equal((await request('/events', { events: [] })).status, 400);
    assert.equal((await request('/events', { events: Array(21).fill(good[4]) })).status, 400);
    assert.equal((await pg.query('SELECT count(*)::int n FROM app_events')).rows[0].n, 0); // rejected batches store nothing
    const ok = await request('/events', { events: good });
    assert.equal(ok.status, 200); assert.equal(ok.body.accepted, good.length);
    const rows = (await pg.query('SELECT * FROM app_events ORDER BY id')).rows;
    assert.equal(rows.length, good.length);
    const columns = Object.keys(rows[0]).sort();
    assert.deepEqual(columns, ['created_at', 'doc', 'error_kind', 'event', 'id', 'pseudonym', 'seconds', 'section', 'step']);
    assert(rows.every(r => /^[0-9a-f]{64}$/.test(r.pseudonym) && r.pseudonym === rows[0].pseudonym));
    assert(!rows[0].pseudonym.includes('101'));
    const other = await request('/consents', GRANT, 202); assert.equal(other.status, 200);
    await request('/events', { events: [good[4]] }, 202);
    const pseudonyms = (await pg.query('SELECT DISTINCT pseudonym FROM app_events')).rows;
    assert.equal(pseudonyms.length, 2); // stable per woman, different between women
    assert.equal((await request('/consents/withdraw', {})).status, 200);
    assert.equal((await request('/events', { events: [good[4]] })).status, 403); // stops after withdrawal
  } finally { await close(); if (savedToken === undefined) delete process.env.BOT_TOKEN; else process.env.BOT_TOKEN = savedToken; }
});

test('topics and main priority: validation, consistency, editing, old answers kept', async () => {
  const { pg, db, request, close } = await setup();
  try {
    assert.equal((await request('/consents', GRANT)).status, 200);
    assert.equal((await request('/anketa/age', { age: 47 })).status, 200);
    assert.equal((await request('/anketa/cycle-situation', { cycleSituation: 'unsure' })).status, 200);
    for (const bad of [{}, { topics: [] }, { topics: 'sleep' }, { topics: ['sleep', 'diagnosis'] }, { topics: Array(7).fill('sleep') }]) {
      assert.equal((await request('/anketa/topics', bad)).status, 400, JSON.stringify(bad));
    }
    assert.equal((await request('/anketa/priority', { priority: 'sleep' })).status, 409); // no topics yet
    let r = await request('/anketa/topics', { topics: ['emotions', 'sleep', 'sleep'] });
    assert.equal(r.status, 200); assert.deepEqual(r.body.focusTopics, ['sleep', 'emotions']); // canonical order, no duplicates
    assert.equal((await request('/anketa/priority', { priority: 'nutrition' })).status, 409); // not among topics
    assert.equal((await request('/anketa/priority', { priority: 'other' })).status, 400);
    assert.equal((await request('/anketa/priority', { priority: 'emotions' })).status, 200);
    let me = (await request('/me')).body;
    assert.deepEqual([me.focusTopics, me.focusPriority], [['sleep', 'emotions'], 'emotions']);
    r = await request('/anketa/topics', { topics: ['sleep', 'emotions', 'movement'] }); // priority still valid
    assert.equal(r.body.focusPriority, 'emotions');
    r = await request('/anketa/topics', { topics: ['sleep'] }); // priority removed -> cleared
    assert.equal(r.body.focusPriority, null);
    assert.equal((await request('/anketa/priority', { priority: 'unsure' })).status, 200);
    r = await request('/anketa/topics', { topics: ['nutrition'] }); // 'unsure' survives topic changes
    assert.equal(r.body.focusPriority, 'unsure');
    const user = await db.getUser('101');
    assert.equal(user.age, 47); assert.equal(user.cycle_situation, 'unsure'); // earlier answers are not removed
    await assert.rejects(pg.query("UPDATE users SET focus_topics = ARRAY['diagnosis'] WHERE telegram_id='101'"));
  } finally { await close(); }
});

test('reached step: validated, only increases, gated', async () => {
  const { request, close } = await setup();
  try {
    assert.equal((await request('/anketa/progress', { step: 4 })).status, 403);
    assert.equal((await request('/consents', GRANT)).status, 200);
    for (const bad of [{}, { step: 2 }, { step: 8 }, { step: '4' }, { step: 4.5 }]) {
      assert.equal((await request('/anketa/progress', bad)).status, 400, JSON.stringify(bad));
    }
    assert.equal((await request('/me')).body.onboardingReachedStep, null);
    assert.equal((await request('/anketa/progress', { step: 4 })).status, 200);
    assert.equal((await request('/anketa/progress', { step: 6 })).status, 200);
    assert.equal((await request('/anketa/progress', { step: 3 })).status, 200); // going back does not lower it
    assert.equal((await request('/me')).body.onboardingReachedStep, 6);
  } finally { await close(); }
});
