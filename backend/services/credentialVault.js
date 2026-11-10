const crypto = require('node:crypto');
function vaultKey(env = process.env) {
  const value = env.STRIPE_CONNECTION_ENCRYPTION_KEY || '';
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw Object.assign(new Error('Stripe connection storage is not configured.'), { statusCode: 503 });
  return key;
}
function seal(value, context, env = process.env) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(env), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['enc1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
function open(value, context, env = process.env) {
  const parts = String(value || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'enc1') throw new Error('Invalid encrypted credential.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(env), Buffer.from(parts[1], 'base64url'));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
}
module.exports = { seal, open, vaultKey };
