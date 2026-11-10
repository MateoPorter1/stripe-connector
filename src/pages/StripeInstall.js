import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RecoveryLogo from '../components/RecoveryLogo';
import { beginStripeInstall, stripeAppRequest } from '../services/stripeApp';
import './Auth.css';
import './StripeInstall.css';

export default function StripeInstall() {
  const { isAuthenticated, loading, sessionError, retrySession } = useAuth();
  const [modes, setModes] = useState([]), [mode, setMode] = useState('live');
  const [checking, setChecking] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    stripeAppRequest('/stripe-app/availability').then(data => { if (active) { setModes(data.modes); setMode(data.modes.includes('live') ? 'live' : data.modes[0] || 'live'); } })
      .catch(() => { if (active) setError('Stripe installation could not be checked. Refresh this page to try again.'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  async function connect() { setBusy(true); setError(''); try { await beginStripeInstall(mode); } catch { setError('Could not open Stripe installation. Please try again or contact support.'); setBusy(false); } }
  return <main className="stripe-install-page"><header><a href="https://reboundmrr.com" aria-label="Rebound website"><RecoveryLogo /></a><a href="https://reboundmrr.com/connection-and-controls">Connection & controls ↗</a></header>
    <section className="stripe-install-card"><span className="stripe-install-eyebrow">CONNECT YOUR BILLING WORKSPACE</span><h1>Connect Stripe.<br/>Stay in control.</h1>
      <p>Bring failed subscription payments into Rebound. You choose when to start a recovery run.</p>
      <ol className="stripe-install-steps"><li><b>1</b><span><strong>Sign in to Rebound</strong>Use the workspace that should own this Stripe connection.</span></li><li><b>2</b><span><strong>Approve access in Stripe</strong>Select the correct account and review the requested permissions.</span></li><li><b>3</b><span><strong>Review before collecting</strong>See failed invoices and eligible saved cards. Connecting never starts charges.</span></li></ol>
      <div className="stripe-install-permissions"><strong>What Rebound needs</strong><p>Read customer, invoice, subscription, payment and saved-card details. Collect eligible existing invoices when you start a run. Stripe’s invoice permission is broader than collection; Rebound does not use it to create or void invoices. We do not request refunds, payouts, transfers or saved-card changes.</p></div>
      {error && <p className="message message-error" role="alert">{error}</p>}
      {loading ? <p role="status">Checking your Rebound login…</p> : sessionError ? <div><p role="alert">{sessionError}</p><button className="auth-button" onClick={retrySession}>Check login again</button></div> : !isAuthenticated ? <div className="stripe-install-actions"><Link className="auth-button" to="/signup?next=stripe-install">Create Rebound account →</Link><Link to="/login?next=stripe-install">Already have an account? Sign in</Link></div> : checking ? <p role="status">Checking Stripe installation…</p> : modes.length ? <div className="stripe-install-actions">{modes.length > 1 && <label>Stripe environment<select value={mode} onChange={e => setMode(e.target.value)}>{modes.map(m => <option key={m} value={m}>{m === 'live' ? 'Live account' : m === 'sandbox' ? 'Sandbox — test payments only' : 'Test mode — test payments only'}</option>)}</select></label>}<button className="auth-button" disabled={busy} onClick={connect}>{busy ? 'Opening Stripe…' : `Connect ${mode === 'live' ? 'Stripe' : 'test Stripe account'} →`}</button></div> : <p className="stripe-install-pending">Stripe app installation is being prepared. Existing workspace connections keep working. <a href="mailto:m@reboundmrr.com">Contact support</a> for access.</p>}
      <p className="stripe-install-foot">14-day trial · $50/month or $500/year. Billing is separate from connecting Stripe. <a href="https://reboundmrr.com/pricing">See pricing</a>.</p>
      <footer><a href="https://reboundmrr.com/privacy">Privacy</a><a href="mailto:m@reboundmrr.com">Support</a></footer>
    </section></main>;
}
