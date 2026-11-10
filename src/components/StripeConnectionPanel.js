import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { stripeAppRequest } from '../services/stripeApp';
import '../pages/StripeInstall.css';

export default function StripeConnectionPanel() {
  const [status, setStatus] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [key, setKey] = useState('');
  const read = useCallback(async () => {
    setLoading(true); setError('');
    try { setStatus(await stripeAppRequest('/profile/stripe-status')); }
    catch { setError('Could not load the Stripe connection. Try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { read(); }, [read]);
  async function disconnect() {
    if (!window.confirm('Disconnect Stripe from Rebound? Any active recovery run will stop before its next attempt. A charge already sent to Stripe may still finish.')) return;
    setBusy(true); setError(''); setMessage('');
    try { const data = await stripeAppRequest('/stripe-app/connection', { method: 'DELETE' }); setMessage(data.message); await read(); }
    catch { setError('Could not confirm disconnection. Check Stripe → Apps and try again.'); }
    finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await stripeAppRequest('/profile/stripe-key', { method: 'PUT', body: JSON.stringify({ stripeApiKey: key }) }); setKey(''); setMessage('Restricted key verified and saved.'); await read(); }
    catch (e) { setError(e.name === 'TimeoutError' ? 'This request timed out. Check your connection status before trying again.' : e.message); }
    finally { setBusy(false); }
  }
  const connected = status?.hasConfiguredStripe;
  return <section className="profile-section"><h2 className="section-title">Stripe connection</h2>
    {loading ? <p role="status">Checking your connection…</p> : <>
      <div className="stripe-status"><span className="status-indicator"><span className={`status-dot ${connected ? 'status-active' : 'status-inactive'}`} /><strong>{connected ? 'Stripe connected' : status?.connection?.status === 'reconnect_required' ? 'Stripe needs to be reconnected' : 'Stripe not connected'}</strong></span></div>
      {status?.connection?.type === 'oauth' && <p className="stripe-connection-description">{status.connection.accountId} · {status.connection.mode === 'live' ? 'Live account' : 'Test account'} · Connected through Stripe Apps</p>}
      {connected && status?.connection?.type === 'legacy' && <p className="stripe-connection-description">Connected with an API key. You can keep this connection or switch to the Stripe app when installation is available.</p>}
      <p className="stripe-connection-description">Choose your Stripe account and review permissions on Stripe. Connecting only loads payment data. Collection starts when you deliberately run it.</p>
      <div className="stripe-connection-actions"><Link className="save-button" to="/stripe/install">{connected ? 'Review / change Stripe connection →' : 'Connect Stripe →'}</Link>{connected && <button className="delete-key-btn" onClick={disconnect} disabled={busy}>Disconnect</button>}{!status && <button className="save-button" onClick={read}>Try again</button>}</div>
      <div className="stripe-connection-note">No payouts, transfers, refunds or saved-card changes are requested by the Marketplace app. To remove its Stripe-side access, uninstall Rebound in <a href="https://dashboard.stripe.com/apps" target="_blank" rel="noopener noreferrer">Stripe → Apps</a>. <a href="https://reboundmrr.com/connection-and-controls" target="_blank" rel="noopener noreferrer">Connection details ↗</a></div>
      {status?.connection?.type !== 'oauth' && <details className="stripe-key-advanced"><summary>Advanced: connect using a restricted key</summary><p className="stripe-connection-description">Use a restricted key with account, customer, subscription, charge, payment-intent and payment-method read access, and invoice read/write access. Do not paste a full secret key.</p><form onSubmit={save} className="api-key-form"><div className="form-group-profile"><label htmlFor="restricted-stripe-key">Restricted Stripe API key</label><input id="restricted-stripe-key" className="api-key-input" type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="rk_live_… or rk_test_…" required maxLength={520} /></div><button className="save-button" disabled={busy}>Verify and save key</button></form></details>}
    </>}
    {error && <p className="message message-error" role="alert">{error}</p>}{message && <p className="message message-success" role="status">{message}</p>}
  </section>;
}
