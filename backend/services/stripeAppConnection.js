const crypto = require('node:crypto');
const Stripe = require('stripe');
const { seal, open, vaultKey } = require('./credentialVault');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const tokenFields = '+accessToken +refreshToken';
const context = (row, field) => `stripe-app:${row.userId}:${row.mode}:${field}`;

function oauthConfig(mode, env = process.env) {
  if (!['live', 'test', 'sandbox'].includes(mode)) throw fail('Choose a supported Stripe environment.');
  if (env.STRIPE_APP_ENABLED !== 'true') throw fail('Stripe app installation is not available yet.', 503);
  vaultKey(env);
  const suffix = mode.toUpperCase();
  const key = env[`STRIPE_APP_DEVELOPER_KEY_${suffix}`];
  const install = env[`STRIPE_APP_INSTALL_URL_${suffix}`];
  const callback = env.STRIPE_APP_REDIRECT_URI || 'https://app.reboundmrr.com/stripe/callback';
  let url, redirect;
  try { url = new URL(install); redirect = new URL(callback); } catch { throw fail('Stripe app installation is not configured for this environment.', 503); }
  if (url.origin !== 'https://marketplace.stripe.com' || !/^\/oauth\/v2\/(?:chnlink_[A-Za-z0-9]+\/)?authorize$/.test(url.pathname) || !url.searchParams.get('client_id') ||
      redirect.protocol !== 'https:' || redirect.pathname !== '/stripe/callback' || redirect.search || redirect.hash ||
      !key || !key.startsWith(mode === 'live' ? 'sk_live_' : 'sk_test_')) throw fail('Stripe app installation configuration is invalid.', 503);
  // Never use Rebound subscription-billing keys for merchant account access.
  return { mode, key, install: url, callback: redirect.toString(), appId: env.STRIPE_APP_ID, clientId: url.searchParams.get('client_id') };
}

function createConnectionService({
  Connections = require('../models/StripeConnection'), States = require('../models/StripeOAuthState'),
  Installs = require('../models/StripeAppInstall'), Users = require('../models/User'), Batches = require('../models/RetryBatch'),
  env = process.env, fetchImpl = global.fetch, now = () => Date.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  async function stop(userId) {
    await Users.updateOne({ _id: userId }, { $set: { hasConfiguredStripe: false, stripeApiKey: null, 'fallbackRecovery.enabled': false } });
    await Batches.updateMany({ userId, status: 'running' }, { $set: { status: 'stopping' } });
  }
  async function tokenRequest(config, params) {
    let response;
    try {
      response = await fetchImpl('https://api.stripe.com/v1/oauth/token', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Basic ${Buffer.from(config.key + ':').toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
      });
    } catch { throw fail('Stripe could not confirm the connection. Connect again before retrying.', 502); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string' ||
        !/^acct_[A-Za-z0-9]+$/.test(body.stripe_user_id || '') || body.livemode !== (config.mode === 'live') || body.scope !== 'stripe_apps') {
      throw fail('Stripe did not authorize the expected app connection. Please connect again.', 502);
    }
    return body;
  }
  async function start(userId, mode = 'live') {
    if (mode === 'live' && env.STRIPE_APP_LIVE_INSTALL_ENABLED !== 'true') throw fail('Live Stripe app installation is not open yet.', 503);
    const config = oauthConfig(mode, env);
    await States.init?.();
    const state = crypto.randomBytes(32).toString('base64url');
    await States.create({ _id: hash(state), userId, mode, expiresAt: new Date(now() + 10 * 60000) });
    const url = new URL(config.install);
    url.searchParams.set('redirect_uri', config.callback);
    url.searchParams.set('state', state);
    return { success: true, url: url.toString() };
  }
  async function complete(userId, { code, state } = {}) {
    if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || typeof code !== 'string' || !/^ac_[A-Za-z0-9_-]{1,500}$/.test(code)) throw fail('This connection link is invalid. Start again from Connect Stripe.');
    // Atomic consume: replay, expired state and another user's callback all fail.
    const saved = await States.findOneAndDelete({ _id: hash(state), userId, expiresAt: { $gt: new Date(now()) } });
    if (!saved) throw fail('This connection expired or was already used. Start again from Connect Stripe.');
    const config = oauthConfig(saved.mode, env);
    await Connections.init?.();
    if (await Batches.exists({ userId, status: { $in: ['running', 'stopping'] } })) throw fail('Stop the current recovery run before changing Stripe accounts.', 409);
    const token = await tokenRequest(config, { grant_type: 'authorization_code', code });
    if (await Connections.exists({ accountId: token.stripe_user_id, mode: saved.mode, status: 'active', userId: { $ne: userId } })) throw fail('That Stripe account is already connected to another Rebound workspace.', 409);
    const row = { userId, mode: saved.mode };
    const install = await Installs.findOne({ accountId: token.stripe_user_id, mode: saved.mode, deleted: false }).sort({ created: -1 });
    try {
      await Connections.findOneAndUpdate({ userId }, { $set: {
        accountId: token.stripe_user_id, mode: saved.mode, status: 'active', connectionVersion: crypto.randomUUID(),
        accessToken: seal(token.access_token, context(row, 'access'), env), refreshToken: seal(token.refresh_token, context(row, 'refresh'), env),
        accessExpiresAt: new Date(now() + 55 * 60000), connectedAt: new Date(now()), generation: 0,
        installId: install?._id || null, disconnectedAt: null, refreshLeaseUntil: null, refreshLeaseId: null
      } }, { upsert: true, new: true, runValidators: true });
    } catch (error) { if (error.code === 11000) throw fail('The Stripe connection changed. Refresh settings before reconnecting.', 409); throw error; }
    await Users.updateOne({ _id: userId }, { $set: { stripeApiKey: null, hasConfiguredStripe: true, 'fallbackRecovery.enabled': false } });
    return { success: true, accountId: token.stripe_user_id, mode: saved.mode };
  }
  async function getAccessToken(userId, expectedVersion) {
    for (let wait = 0; wait < 40; wait++) {
      const row = await Connections.findOne({ userId }).select(tokenFields);
      if (!row || row.status !== 'active' || (expectedVersion && row.connectionVersion !== expectedVersion)) throw fail('Stripe was disconnected or changed. Connect again in settings.', 409);
      if (+row.accessExpiresAt > now()) return open(row.accessToken, context(row, 'access'), env);
      const leaseId = crypto.randomUUID();
      const leased = await Connections.findOneAndUpdate({ _id: row._id, status: 'active', connectionVersion: row.connectionVersion, generation: row.generation,
        $or: [{ refreshLeaseUntil: null }, { refreshLeaseUntil: { $lt: new Date(now()) } }] },
      { $set: { refreshLeaseId: leaseId, refreshLeaseUntil: new Date(now() + 45000) } }, { new: true }).select(tokenFields);
      if (!leased) { await sleep(200); continue; }
      try {
        const token = await tokenRequest(oauthConfig(row.mode, env), { grant_type: 'refresh_token', refresh_token: open(leased.refreshToken, context(row, 'refresh'), env) });
        if (token.stripe_user_id !== row.accountId) throw fail('Stripe returned a different account. Connect again.', 409);
        const updated = await Connections.updateOne({ _id: row._id, status: 'active', connectionVersion: row.connectionVersion, refreshLeaseId: leaseId }, { $set: {
          accessToken: seal(token.access_token, context(row, 'access'), env), refreshToken: seal(token.refresh_token, context(row, 'refresh'), env),
          accessExpiresAt: new Date(now() + 55 * 60000), refreshLeaseId: null, refreshLeaseUntil: null
        }, $inc: { generation: 1 } });
        if (!updated.matchedCount) throw fail('Stripe was disconnected during token refresh.', 409);
        return token.access_token;
      } catch (error) {
        // A rotated refresh token may have been consumed even after a timeout.
        // Never retry that grant automatically or leave collection authorized.
        const revoked = await Connections.updateOne({ _id: row._id, connectionVersion: row.connectionVersion, refreshLeaseId: leaseId }, { $set: { status: 'reconnect_required', accessToken: null, refreshToken: null, refreshLeaseId: null, refreshLeaseUntil: null } });
        if (revoked.matchedCount) await stop(userId);
        throw error;
      }
    }
    throw fail('Stripe connection refresh is busy. Please try again shortly.', 503);
  }
  async function disconnect(userId, expectedVersion) {
    const changed = await Connections.updateOne({ userId, ...(expectedVersion ? { connectionVersion: expectedVersion } : {}) }, { $set: { status: 'disconnected', accessToken: null, refreshToken: null, disconnectedAt: new Date(now()), refreshLeaseId: null, refreshLeaseUntil: null } });
    if (expectedVersion && !changed.matchedCount) return { success: true };
    await States.deleteMany({ userId });
    await stop(userId);
    return { success: true, message: 'Disconnected from Rebound. To remove Stripe-side permissions, uninstall Rebound in Stripe → Apps.' };
  }
  async function receive(event, mode) {
    const config = oauthConfig(mode, env), object = event.data?.object;
    if (!object || event.livemode !== (mode === 'live')) throw fail('Webhook environment does not match.', 400);
    const type = event.type;
    if (['apps.install.created', 'apps.install.updated', 'app.install.created', 'app.install.updated'].includes(type)) {
      if (object.app !== config.appId || object.status !== 'installed' || object.account !== event.account) return;
      // Create events only record installation; they never connect a workspace or start retries.
      await Installs.updateOne({ _id: object.id }, { $setOnInsert: { accountId: event.account, mode, created: object.created, deleted: false } }, { upsert: true });
      return;
    }
    if (['apps.install.deleted', 'app.install.deleted'].includes(type)) {
      if (typeof object.id !== 'string' || !object.deleted) return;
      if (!event.account) return;
      const install = await Installs.findById(object.id);
      if (install && (install.accountId !== event.account || install.mode !== mode)) return;
      await Installs.updateOne({ _id: object.id }, { $setOnInsert: { accountId: event.account, mode, created: event.created }, $set: { deleted: true } }, { upsert: true });
      const row = await Connections.findOne({ accountId: event.account, mode, status: 'active', connectedAt: { $lte: new Date(event.created * 1000 + 999) }, $or: [{ installId: object.id }, { installId: null }] });
      if (row) await disconnect(row.userId, row.connectionVersion);
    } else if (type === 'account.application.deauthorized') {
      if (![config.appId, config.clientId].filter(Boolean).includes(object.id) || !event.account) return;
      const row = await Connections.findOne({ accountId: event.account, mode, status: 'active', connectedAt: { $lte: new Date(event.created * 1000 + 999) } });
      if (row) await disconnect(row.userId, row.connectionVersion);
    }
  }
  return { start, complete, getAccessToken, disconnect, receive };
}

let runtime;
function service() { if (!runtime) runtime = createConnectionService(); return runtime; }
async function connectionFingerprint(userId) {
  const row = await require('../models/StripeConnection').findOne({ userId });
  if (row?.status === 'active') return hash(`oauth:${row._id}:${row.connectionVersion}`);
  if (row) throw fail('Reconnect Stripe in workspace settings before continuing.', 409);
  const user = await require('../models/User').findById(userId).select('+stripeApiKey');
  if (!user?.stripeApiKey) throw fail('Connect Stripe in workspace settings first.', 400);
  const key = user.stripeApiKey.startsWith('enc1.') ? open(user.stripeApiKey, `legacy-stripe:${userId}`) : user.stripeApiKey;
  return hash(key);
}
async function connectedStripe(userId) {
  const row = await require('../models/StripeConnection').findOne({ userId });
  if (row?.status === 'active') {
    // Resolve tokens per API call, so long batches survive normal token expiry.
    // A connection change/disconnect is checked before every call.
    const stripe = {};
    stripe.accounts = { retrieve: async () => {
      await service().getAccessToken(userId, row.connectionVersion);
      return { id: row.accountId };
    } };
    for (const resource of ['customers', 'paymentMethods', 'invoices', 'paymentIntents', 'charges']) {
      stripe[resource] = new Proxy({}, { get: (_, method) => async (...args) => {
        const key = await service().getAccessToken(userId, row.connectionVersion);
        const client = new Stripe(key, { apiVersion: '2023-10-16', timeout: 20000, maxNetworkRetries: 0 });
        return client[resource][method](...args);
      } });
    }
    return { stripe, keyHash: hash(`oauth:${row._id}:${row.connectionVersion}`) };
  }
  if (row) throw fail('Reconnect Stripe in workspace settings before continuing.', 409);
  const user = await require('../models/User').findById(userId).select('+stripeApiKey');
  if (!user?.stripeApiKey) throw fail('Connect Stripe in workspace settings first.', 400);
  const key = user.stripeApiKey.startsWith('enc1.') ? open(user.stripeApiKey, `legacy-stripe:${userId}`) : user.stripeApiKey;
  return { user, stripe: new Stripe(key, { timeout: 20000, maxNetworkRetries: 0 }), keyHash: hash(key) };
}
module.exports = { createConnectionService, oauthConfig, service, connectedStripe, connectionFingerprint, hash };
