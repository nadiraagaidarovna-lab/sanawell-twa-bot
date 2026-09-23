// Isolated PostgreSQL/WASM only. No dotenv, real pg connection, or user data.
// SANAWELL_TEST_PGLITE_PATH=<installed @electric-sql/pglite> node --test backend/test/onboarding-cycle-mht.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { PGlite } = require(process.env.SANAWELL_TEST_PGLITE_PATH || '@electric-sql/pglite');
const src = path.resolve(__dirname, '../src');
const migration = fs.readFileSync(path.resolve(__dirname, '../migrations/20260923_onboarding_cycle_mht.sql'), 'utf8');
const schema = fs.readFileSync(path.join(src, 'db.js'), 'utf8').match(/async function initSchema\(\) \{\s*await pool.query\(`([\s\S]*?)`\);/)[1];
function load(file, overrides = {}) {
  const filename = path.join(src, file), nativeRequire = createRequire(filename), module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })(
    name => overrides[name] || nativeRequire(name), module, module.exports);
  return module.exports;
}
function auth(id) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id }) });
  const secret = crypto.createHmac('sha256', 'WebAppData').update('isolated-test-token').digest();
  const data = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  params.set('hash', crypto.createHmac('sha256', secret).update(data).digest('hex'));
  return params.toString();
}

test('fresh schema: explicit migration is nullable, default-free and repeatable', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(schema);
    await pg.exec(migration);
    await pg.exec(migration);
    const columns = (await pg.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='users' AND column_name IN ('cycle_situation','mht_status') ORDER BY column_name")).rows;
    assert.equal(columns.length, 2);
    for (const column of columns) assert.deepEqual({ ...column, column_name: undefined }, { column_name: undefined, data_type: 'text', is_nullable: 'YES', column_default: null });
    await pg.query("INSERT INTO users (telegram_id) VALUES ('fresh')");
    assert.deepEqual((await pg.query("SELECT cycle_situation,mht_status FROM users WHERE telegram_id='fresh'")).rows[0], { cycle_situation: null, mht_status: null });
    for (const column of ['cycle_situation', 'mht_status']) {
      await assert.rejects(pg.query(`UPDATE users SET ${column}='invalid' WHERE telegram_id='fresh'`), error => error.code === '23514');
    }
  } finally { await pg.close(); }
});

test('existing schema, authenticated narrow endpoints, validation, hydration and startup independence', async () => {
  const pg = new PGlite(); let server;
  try {
    class TestPool { query(sql, params) { return params ? pg.query(sql, params) : pg.exec(sql).then(r => r[r.length - 1]); } }
    const db = load('db.js', { pg: { Pool: TestPool } });
    await db.initSchema(); // Startup must succeed without the migration.
    await pg.query("INSERT INTO users (telegram_id,display_name,age,menopause_path,self_perceived_stage,medical_disclaimer_consent_at,data_storage_consent_at,onboarding_anketa_completed,onboarding_welcome_seen) VALUES ('101','Existing',49,'surgical','unsure','2020-01-01','2020-01-02',true,true)");
    const before = await db.getUser('101');
    const { buildRouter } = load('routes.js', { './db': db });
    const { requireTelegramAuth } = load('telegramAuth.js');
    const app = createRequire(path.join(src, 'routes.js'))('express')();
    app.use(createRequire(path.join(src, 'routes.js'))('express').json());
    app.use('/api', buildRouter({ requireAuth: requireTelegramAuth('isolated-test-token') }));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function request(route, body, id = 101, signed = true) {
      const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(signed ? { 'X-Telegram-Init-Data': auth(id) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    }
    let me = await request('/me');
    assert.equal(me.status, 200); assert.equal(me.body.cycleSituation, null); assert.equal(me.body.mhtStatus, null);
    const gates = { onboarded: me.body.onboarded, onboardingAnketaCompleted: me.body.onboardingAnketaCompleted, onboardingWelcomeSeen: me.body.onboardingWelcomeSeen };
    for (const [route, field, column, allowed] of [
      ['/anketa/cycle-situation', 'cycleSituation', 'cycle_situation', ['regular','changing','no_period_12m','post_surgery','treatment_affected','other','unsure']],
      ['/anketa/mht-status', 'mhtStatus', 'mht_status', ['current','no','considering','previous','prefer_not_to_say']],
    ]) {
      assert.equal((await request(route, { [field]: allowed[0] }, 101, false)).status, 401);
      assert.equal((await request(route, { [field]: allowed[0] })).status, 503);
    }
    await pg.exec(migration);
    const after = await db.getUser('101');
    assert.equal(after.cycle_situation, null); assert.equal(after.mht_status, null);
    for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], key);
    for (const [route, field, column, allowed] of [
      ['/anketa/cycle-situation', 'cycleSituation', 'cycle_situation', ['regular','changing','no_period_12m','post_surgery','treatment_affected','other','unsure']],
      ['/anketa/mht-status', 'mhtStatus', 'mht_status', ['current','no','considering','previous','prefer_not_to_say']],
    ]) {
      for (const value of allowed) {
        const previous = await db.getUser('101');
        assert.equal((await request(route, { [field]: value, menopausePath: 'natural', displayName: 'Must not write', telegramId: '202' })).status, 200);
        const current = await db.getUser('101');
        assert.equal(current[column], value);
        for (const key of Object.keys(previous).filter(k => k !== column)) assert.deepEqual(current[key], previous[key], key);
        assert.equal((await request('/me')).body[field], value);
        assert.equal(await db.getUser('202'), null);
      }
      const previous = await db.getUser('101');
      for (const value of [undefined, null, '', 'invalid', 'REGULAR', 1, false, [], {}, ' regular ', 'absent_12_months', 'past']) {
        assert.equal((await request(route, value === undefined ? {} : { [field]: value })).status, 400);
      }
      assert.deepEqual(await db.getUser('101'), previous);
    }
    const saved = await db.getUser('101');
    await pg.exec(migration); await db.initSchema(); // Neither repeat nor startup alters answers.
    assert.deepEqual(await db.getUser('101'), saved);
    me = (await request('/me')).body;
    for (const [key, value] of Object.entries(gates)) assert.equal(me[key], value);
    assert.equal((await request('/anketa/mht-status', { mhtStatus: 'prefer_not_to_say' }, 303)).status, 200);
    const fresh = (await request('/me', undefined, 303)).body;
    assert.equal(fresh.mhtStatus, 'prefer_not_to_say'); assert.equal(fresh.cycleSituation, null); assert.equal(fresh.onboarded, false);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await pg.close();
  }
});
