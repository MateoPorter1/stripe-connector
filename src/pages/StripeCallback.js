import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RecoveryLogo from '../components/RecoveryLogo';
import { stripeAppRequest } from '../services/stripeApp';
import './StripeInstall.css';

export default function StripeCallback() {
  const { loading, isAuthenticated, sessionError } = useAuth();
  const [callback] = useState(() => Object.fromEntries(new URLSearchParams(window.location.search)));
  const [result, setResult] = useState(null), [error, setError] = useState('');
  const exchange = useRef(null);
  useEffect(() => {
    // Remove short-lived authorization data before any user follows another link.
    window.history.replaceState(null, '', '/stripe/callback');
    if (loading || !isAuthenticated) return;
    if (callback.error || !callback.code || !callback.state) { setError('Stripe was not connected. Start again when you are ready.'); return; }
    if (!exchange.current) exchange.current = stripeAppRequest('/stripe-app/complete', { method: 'POST', body: JSON.stringify({ code: callback.code, state: callback.state }) });
    let active = true;
    exchange.current.then(data => { if (active) setResult(data); }).catch(e => { if (active) setError(e.name === 'TimeoutError' ? 'The response timed out. Check workspace settings before connecting again.' : e.message); });
    return () => { active = false; };
  }, [callback, loading, isAuthenticated]);
  return <main className="stripe-install-page"><header><Link to="/stripe/install"><RecoveryLogo /></Link></header><section className="stripe-install-card">
    <h1>{result ? 'Stripe connected.' : 'Finishing your connection.'}</h1>
    {result ? <><p>Connected account <strong>{result.accountId}</strong> · {result.mode === 'live' ? 'Live' : result.mode === 'sandbox' ? 'Sandbox' : 'Test mode'}.</p><p>No collection has started. Review your invoices first.</p><Link className="auth-button" to="/dashboard">Review failed payments →</Link></> : loading ? <p role="status">Checking your Rebound login…</p> : sessionError ? <><p role="alert">{sessionError}</p><Link to="/stripe/install">Return to installation</Link></> : !isAuthenticated ? <><p>Sign in to the correct workspace, then start a fresh Stripe connection.</p><Link className="auth-button" to="/login?next=stripe-install">Sign in →</Link></> : error ? <><p role="alert">{error}</p><Link to="/profile">Check connection settings</Link><br/><Link to="/stripe/install">Start a new connection</Link></> : <p role="status">Verifying Stripe’s response. This normally takes a few seconds…</p>}
  </section></main>;
}
