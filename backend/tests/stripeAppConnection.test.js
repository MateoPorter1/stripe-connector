const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { seal, open } = require('../services/credentialVault');
const { createConnectionService, oauthConfig } = require('../services/stripeAppConnection');
const env = {
  STRIPE_APP_ENABLED: 'true', STRIPE_CONNECTION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  STRIPE_APP_ID: 'app_rebound', STRIPE_APP_DEVELOPER_KEY_TEST: 'sk_test_developer', STRIPE_APP_DEVELOPER_KEY_LIVE: 'sk_live_developer',
  STRIPE_APP_INSTALL_URL_TEST: 'https://marketplace.stripe.com/oauth/v2/authorize?client_id=ca_rebound_test',
  STRIPE_APP_INSTALL_URL_LIVE: 'https://marketplace.stripe.com/oauth/v2/authorize?client_id=ca_rebound_live'
};
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(f => matches(row, f));
    const actual = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([op, v]) =>
      op === '$gt' ? +actual > +v : op === '$lt' ? +actual < +v : op === '$lte' ? +actual <= +v : op === '$ne' ? String(actual) !== String(v) : op === '$in' ? v.includes(actual) : false);
    return value == null ? actual == null : String(actual) === String(value);
  });
}
function model() {
  const rows = [];
  const query = result => ({ select() { return this; }, sort() { return this; }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } });
  function update(row, change, inserted = false) {
    if (inserted) Object.assign(row, change.$setOnInsert);
    Object.assign(row, change.$set);
    for (const [k, v] of Object.entries(change.$inc || {})) row[k] = (row[k] || 0) + v;
  }
  return { rows,
    async create(row) { const r = { _id: crypto.randomUUID(), generation: 0, ...row }; rows.push(r); return r; },
    findOne(filter) { return query(rows.find(r => matches(r, filter)) || null); },
    findById(id) { return query(rows.find(r => r._id === id) || null); },
    async exists(filter) { return rows.some(r => matches(r, filter)); },
    async findOneAndDelete(filter) { const i = rows.findIndex(r => matches(r, filter)); return i < 0 ? null : rows.splice(i, 1)[0]; },
    async deleteMany(filter) { for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], filter)) rows.splice(i, 1); },
    findOneAndUpdate(filter, change, options = {}) {
      let row = rows.find(r => matches(r, filter));
      if (!row && options.upsert) { row = { _id: crypto.randomUUID(), generation: 0, ...filter }; rows.push(row); update(row, change, true); }
      else if (row) update(row, change);
      return query(row || null);
    },
    async updateOne(filter, change, options = {}) {
      let row = rows.find(r => matches(r, filter));
      if (!row && options.upsert) { row = { _id: crypto.randomUUID(), ...filter }; rows.push(row); update(row, change, true); return { matchedCount: 0, upsertedCount: 1 }; }
      if (row) update(row, change);
      return { matchedCount: row ? 1 : 0 };
    },
    async updateMany(filter, change) { for (const row of rows) if (matches(row, filter)) update(row, change); }
  };
}
function fixture() {
  let time = Date.UTC(2026, 10, 10), response = { access_token: 'access_secret', refresh_token: 'refresh_secret', stripe_user_id: 'acct_merchant', livemode: false, scope: 'stripe_apps' };
  const Connections = model(), States = model(), Installs = model(), Users = model(), Batches = model(), calls = [];
  const service = createConnectionService({ Connections, States, Installs, Users, Batches, env, now: () => time,
    fetchImpl: async (url, options) => { calls.push({ url, options }); if (response instanceof Error) throw response; return { ok: true, json: async () => ({ ...response }) }; } });
  return { service, Connections, States, Installs, Users, Batches, calls, advance: n => { time += n; }, setResponse: value => { response = value; }, now: () => time };
}
async function connect(f, user = 'user_a') { const { url } = await f.service.start(user, 'test'); return f.service.complete(user, { state: new URL(url).searchParams.get('state'), code: 'ac_fixture' }); }

test('credential vault encrypts, authenticates, binds to owner and fails closed without a key', () => {
  const token = 'private merchant token', a = seal(token, 'user_a', env), b = seal(token, 'user_a', env);
  assert.notEqual(a, b); assert(!a.includes(token)); assert.equal(open(a, 'user_a', env), token);
  assert.throws(() => open(a, 'user_b', env));
  assert.throws(() => open(a.slice(0, -3) + 'xxx', 'user_a', env));
  assert.throws(() => seal(token, 'user_a', {}));
});
test('configuration pins Marketplace origin and separates live/test credentials', () => {
  assert.equal(oauthConfig('test', env).key, 'sk_test_developer');
  assert.equal(oauthConfig('live', env).key, 'sk_live_developer');
  assert.throws(() => oauthConfig('test', { ...env, STRIPE_APP_INSTALL_URL_TEST: 'https://evil.example/oauth/v2/authorize?client_id=x' }));
  assert.throws(() => oauthConfig('test', { ...env, STRIPE_APP_DEVELOPER_KEY_TEST: 'sk_live_wrong' }));
  assert.throws(() => oauthConfig('test', { ...env, STRIPE_APP_ENABLED: 'false' }));
});
test('OAuth state is user-bound, one-time and contains no user identity', async () => {
  const f = fixture(), { url } = await f.service.start('user_a', 'test'), state = new URL(url).searchParams.get('state');
  assert(!url.includes('user_a')); assert.equal(state.length, 43);
  assert.notEqual(f.States.rows[0]._id, state);
  await assert.rejects(f.service.complete('user_b', { state, code: 'ac_ok' }), /expired/);
  assert.equal(f.calls.length, 0);
  await f.service.complete('user_a', { state, code: 'ac_ok' });
  await assert.rejects(f.service.complete('user_a', { state, code: 'ac_ok' }), /expired/);
  assert.equal(f.calls.length, 1);
  assert.equal(f.Connections.rows[0].status, 'active');
  assert(!JSON.stringify(f.Connections.rows).includes('access_secret'));
});
test('expired callbacks cannot exchange a token', async () => {
  const f = fixture(), { url } = await f.service.start('user_a', 'test'); f.advance(600001);
  await assert.rejects(f.service.complete('user_a', { state: new URL(url).searchParams.get('state'), code: 'ac_ok' }), /expired/);
  assert.equal(f.calls.length, 0);
});
test('Stripe mode mismatch never connects an account', async () => {
  const f = fixture(); f.setResponse({ access_token: 'x', refresh_token: 'y', stripe_user_id: 'acct_merchant', livemode: true, scope: 'stripe_apps' });
  await assert.rejects(connect(f), /expected app connection/); assert.equal(f.Connections.rows.length, 0);
});
test('another workspace cannot claim an active Stripe account', async () => {
  const f = fixture(); await connect(f); await assert.rejects(connect(f, 'user_b'), /another Rebound workspace/);
  assert.equal(f.Connections.rows.length, 1); assert.equal(f.Connections.rows[0].userId, 'user_a');
});
test('connection cannot change while a recovery run is active', async () => {
  const f = fixture(); await f.Batches.create({ userId: 'user_a', status: 'running' });
  await assert.rejects(connect(f), /Stop the current/); assert.equal(f.calls.length, 0);
});
test('refresh rotates tokens without changing the connection identity', async () => {
  const f = fixture(); await connect(f); const row = f.Connections.rows[0], version = row.connectionVersion;
  f.advance(56 * 60000); f.setResponse({ access_token: 'next_access', refresh_token: 'next_refresh', stripe_user_id: 'acct_merchant', livemode: false, scope: 'stripe_apps' });
  assert.equal(await f.service.getAccessToken('user_a', version), 'next_access');
  assert.equal(row.connectionVersion, version); assert.equal(row.generation, 1);
  assert.equal(open(row.refreshToken, 'stripe-app:user_a:test:refresh', env), 'next_refresh');
  assert.equal(f.calls[1].url, 'https://api.stripe.com/v1/oauth/token');
  assert.equal(new URLSearchParams(f.calls[1].options.body).get('grant_type'), 'refresh_token');
});
test('uncertain refresh is not retried and requires reconnection', async () => {
  const f = fixture(); await connect(f); f.advance(56 * 60000); f.setResponse(new Error('network timeout with private request details'));
  await assert.rejects(f.service.getAccessToken('user_a'), /could not confirm/);
  assert.equal(f.Connections.rows[0].status, 'reconnect_required');
  assert.equal(f.Connections.rows[0].refreshToken, null);
  await assert.rejects(f.service.getAccessToken('user_a'), /disconnected/); assert.equal(f.calls.length, 2);
});
test('disconnect purges tokens and stops runs; stale version cannot disconnect a new connection', async () => {
  const f = fixture(); await connect(f); const v = f.Connections.rows[0].connectionVersion;
  await f.service.disconnect('user_a', 'old_version'); assert.equal(f.Connections.rows[0].status, 'active');
  await f.Batches.create({ userId: 'user_a', status: 'running' });
  await f.service.disconnect('user_a', v); assert.equal(f.Connections.rows[0].accessToken, null); assert.equal(f.Connections.rows[0].status, 'disconnected');
  assert.equal(f.Batches.rows[0].status, 'stopping');
  await assert.rejects(f.service.getAccessToken('user_a', v), /disconnected/);
});
test('install notifications never connect users or trigger collection; unrelated app events are ignored', async () => {
  const f = fixture();
  await f.service.receive({ type: 'apps.install.created', account: 'acct_merchant', livemode: false, created: 1, data: { object: { id: 'appinst_1', app: 'app_rebound', status: 'installed', account: 'acct_merchant', created: 1 } } }, 'test');
  assert.equal(f.Installs.rows.length, 1); assert.equal(f.Connections.rows.length, 0); assert.equal(f.Batches.rows.length, 0);
  await f.service.receive({ type: 'account.application.deauthorized', account: 'acct_merchant', livemode: false, created: 2, data: { object: { id: 'ca_other_app' } } }, 'test');
  assert.equal(f.Connections.rows.length, 0);
});
test('valid uninstall disconnects only its account and ignores stale/unrelated events', async () => {
  const f = fixture(); await connect(f); const row = f.Connections.rows[0];
  const event = { type: 'account.application.deauthorized', account: 'acct_merchant', livemode: false, created: Math.floor(f.now() / 1000), data: { object: { id: 'ca_rebound_test' } } };
  await f.service.receive({ ...event, account: 'acct_other' }, 'test'); assert.equal(row.status, 'active');
  await f.service.receive({ ...event, created: event.created - 10 }, 'test'); assert.equal(row.status, 'active');
  await f.service.receive(event, 'test'); assert.equal(row.status, 'disconnected');
  await f.service.receive(event, 'test'); assert.equal(row.status, 'disconnected');
});

test('configured review workspace cannot start or complete a non-sandbox connection', async () => {
  const f = fixture();
  const reviewEnv = { ...env, STRIPE_APP_REVIEW_USER_ID: 'user_a', STRIPE_APP_LIVE_INSTALL_ENABLED: 'true',
    STRIPE_APP_DEVELOPER_KEY_SANDBOX: 'sk_test_sandbox', STRIPE_APP_INSTALL_URL_SANDBOX: 'https://marketplace.stripe.com/oauth/v2/authorize?client_id=ca_sandbox' };
  const review = createConnectionService({ Connections:f.Connections, States:f.States, Installs:f.Installs, Users:f.Users, Batches:f.Batches, env:reviewEnv, now:f.now,
    fetchImpl:async()=>{ throw new Error('A restricted grant must never be exchanged'); } });
  for (const mode of ['live','test']) await assert.rejects(review.start('user_a',mode), e=>e.statusCode===403);
  assert.match((await review.start('user_a','sandbox')).url,/ca_sandbox/);
  const earlier = await f.service.start('user_a','test');
  await assert.rejects(review.complete('user_a',{state:new URL(earlier.url).searchParams.get('state'),code:'ac_old'}),e=>e.statusCode===403);
  assert.equal(f.Connections.rows.length,0);
});
