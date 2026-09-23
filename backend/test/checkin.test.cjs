// Run: SANAWELL_TEST_PGLITE_PATH=<installed @electric-sql/pglite> node --test backend/test/checkin.test.cjs
// Isolated PostgreSQL/WASM only: never loads dotenv, pg Pool, or DATABASE_URL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { PGlite } = require(process.env.SANAWELL_TEST_PGLITE_PATH || '@electric-sql/pglite');
const src = path.resolve(__dirname, '../src');
function load(file, overrides) {
  const filename = path.join(src, file);
  const nativeRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })(
    name => overrides[name] || nativeRequire(name), module, module.exports);
  return module.exports;
}

test('additive migration and backward-compatible check-in API', async () => {
  const pg = new PGlite();
  const dbSource = fs.readFileSync(path.join(src, 'db.js'), 'utf8');
  // Create the actual legacy schema without the two new ALTER statements.
  const schema = dbSource.match(/async function initSchema\(\) \{\s*await pool.query\(`([\s\S]*?)`\);/)[1];
  const legacySchema = schema.replace(/    ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS energy_score[\s\S]*?CHECK \(hot_flashes IN \('none', 'mild', 'moderate', 'severe'\)\);/, '');
  await pg.exec(legacySchema);
  await pg.query("INSERT INTO users (telegram_id) VALUES ('legacy')");
  await pg.query("INSERT INTO daily_checkins (telegram_id,checkin_date,sleep_score,mood_score,memory_score) VALUES ('legacy','2020-01-01',3,4,5)");
  const legacy = (await pg.query("SELECT * FROM daily_checkins WHERE telegram_id='legacy'")).rows[0];
  class TestPool {
    query(sql, params) {
      return params ? pg.query(sql, params) : pg.exec(sql).then(results => results[results.length - 1]);
    }
  }
  const db = load('db.js', { pg: { Pool: TestPool } });
  let server;
  try {
    await db.initSchema();
    await db.initSchema(); // Idempotent, including on a populated old schema.
    const migrated = (await pg.query("SELECT * FROM daily_checkins WHERE telegram_id='legacy'")).rows[0];
    assert.equal(migrated.energy_score, null);
    assert.equal(migrated.hot_flashes, null);
    for (const key of Object.keys(legacy)) assert.deepEqual(migrated[key], legacy[key]);
    const { buildRouter } = load('routes.js', { './db': db });
    const express = createRequire(path.join(src, 'routes.js'))('express');
    const app = express();
    app.use(express.json());
    app.use('/api', buildRouter({ requireAuth(req, res, next) { req.telegramId = 'test-user'; next(); } }));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    async function request(route, body) {
      const res = await fetch(base + route, body === undefined ? {} : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    }
    const old = { sleep: 7, mood: 6, memory: 8 };
    let result = await request('/checkin', old);
    assert.equal(result.status, 200);
    assert.equal(result.body.checkin.energyScore, null);
    assert.equal(result.body.checkin.hot_flashes, null);
    assert.equal(result.body.checkin.memoryScore, 8);
    assert.equal(result.body.checkin.canCorrect, true);
    const missingHistory = (await request('/checkin/history?days=7')).body.history[0];
    assert.equal(missingHistory.energyScore, null);
    assert.equal(missingHistory.hot_flashes, null);
    const first = await db.getTodayCheckin('test-user');
    result = await request('/checkin', { ...old, energy: 10, hot_flashes: 'moderate' });
    assert.equal(result.status, 200);
    assert.equal(result.body.checkin.energyScore, 10);
    assert.equal(result.body.checkin.hot_flashes, 'moderate');
    result = await request('/checkin', { ...old, memory: 9 });
    assert.equal(result.body.checkin.energyScore, 10);
    assert.equal(result.body.checkin.hot_flashes, 'moderate');
    assert.equal(result.body.checkin.memoryScore, 9);
    result = await request('/checkin', { ...old, energy: 1 });
    assert.equal(result.body.checkin.energyScore, 1);
    assert.equal(result.body.checkin.hot_flashes, 'moderate');
    for (const hot_flashes of ['none', 'mild', 'moderate', 'severe']) {
      result = await request('/checkin', { ...old, hot_flashes });
      assert.equal(result.status, 200);
      assert.equal(result.body.checkin.energyScore, 1);
      assert.equal(result.body.checkin.hot_flashes, hot_flashes);
    }
    const history = (await request('/checkin/history?days=7')).body.history;
    assert.equal(history[0].energyScore, 1);
    assert.equal(history[0].hot_flashes, 'severe');
    const beforeInvalid = await db.getTodayCheckin('test-user');
    for (const energy of [0, 11, 1.5, '5', false, {}, []]) {
      assert.equal((await request('/checkin', { ...old, energy })).status, 400);
    }
    for (const hot_flashes of ['unknown', '', 1, false, {}, []]) {
      assert.equal((await request('/checkin', { ...old, hot_flashes })).status, 400);
    }
    assert.equal((await request('/checkin', { ...old, memory: 11 })).status, 400);
    assert.deepEqual(await db.getTodayCheckin('test-user'), beforeInvalid);
    await assert.rejects(pg.query("UPDATE daily_checkins SET energy_score=11 WHERE telegram_id='test-user'"));
    await assert.rejects(pg.query("UPDATE daily_checkins SET hot_flashes='invalid' WHERE telegram_id='test-user'"));
    result = await request('/checkin', { ...old, energy: null, hot_flashes: null });
    assert.equal(result.body.checkin.energyScore, null);
    assert.equal(result.body.checkin.hot_flashes, null);
    const edited = await db.getTodayCheckin('test-user');
    assert.equal(edited.id, first.id);
    assert.equal(edited.created_at, first.created_at);
    assert.equal(edited.corrected_manually, 1);
    await pg.query("UPDATE daily_checkins SET created_at=to_char(now() AT TIME ZONE 'utc' - interval '25 hours','YYYY-MM-DD HH24:MI:SS') WHERE telegram_id='test-user'");
    assert.equal((await request('/checkin')).body.checkin.canCorrect, false);
    // Preserve existing semantics: POST is not newly restricted by canCorrect.
    assert.equal((await request('/checkin', old)).status, 200);
    assert.equal((await request('/checkin')).body.checkin.canCorrect, false);
    console.log('Verified: old rows, repeated migration, old/new payload, omitted-field preservation, partial edits, explicit null, validation, SQL constraints, history, create/edit and unchanged canCorrect.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await pg.close();
  }
});
