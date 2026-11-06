import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import RecoveryBanner from '../components/RecoveryBanner';
import { LuRefreshCw, LuExternalLink, LuCircleCheckBig } from 'react-icons/lu';
import { getSubscriptionRecovery, formatCurrency, formatDate } from '../services/api';
import './Dashboard.css';

const labels = {
  scheduled: 'Retry scheduled', processing: 'Payment processing', customer_action: 'Customer action needed',
  manual_collection: 'Customer payment required', paused: 'Collection paused', no_schedule: 'No retry scheduled',
  paid_after_retries: 'Paid after retries', ended: 'Recovery ended'
};

export default function Dashboard() {
  const [view, setView] = useState('open');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(0);
  const [updated, setUpdated] = useState(null);
  const active = useRef(null);
  const refreshTimer = useRef(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    clearTimeout(refreshTimer.current);
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setError(''); setReviewed(0);
    const rows = new Map();
    let cursor = null;
    try {
      do {
        const result = await getSubscriptionRecovery(view, cursor, controller.signal);
        if (controller.signal.aborted || !mounted.current) return;
        result.invoices.forEach(invoice => rows.set(invoice.id, invoice));
        setInvoices([...rows.values()]);
        setReviewed(previous => previous + result.totalFetched);
        if (result.hasMore && (!result.nextCursor || result.nextCursor === cursor)) throw new Error('Could not finish the invoice scan. Please refresh again.');
        cursor = result.nextCursor;
      } while (cursor);
      setUpdated(new Date());
    } catch (err) {
      if (!controller.signal.aborted && mounted.current) setError(err.message);
    } finally {
      if (active.current === controller && mounted.current) {
        setLoading(false);
        refreshTimer.current = setTimeout(() => refresh(), 60000);
      }
    }
  }, [view]);

  useEffect(() => {
    mounted.current = true;
    setInvoices([]); setUpdated(null);
    refresh();
    return () => { mounted.current = false; active.current?.abort(); clearTimeout(refreshTimer.current); };
  }, [refresh]);

  const scheduled = invoices.filter(invoice => invoice.state === 'scheduled').length;
  const needsAttention = invoices.filter(invoice => !['scheduled', 'processing', 'paid_after_retries'].includes(invoice.state)).length;
  const totals = invoices.reduce((result, invoice) => ({ ...result, [invoice.currency]: (result[invoice.currency] || 0) + invoice.amount }), {});

  return <div className="dashboard-layout"><Sidebar /><main className="dashboard-content"><div className="container">
    <RecoveryBanner title="Recovery runs. You get on with your day." subtitle="Stripe collects unpaid subscription invoices automatically, according to your retry policy—even when this app is closed." />
    <div className="workspace-heading"><div><h1>Automatic recovery</h1><p>Invoice outcomes and the next collection attempt, directly from Stripe.</p></div>
      <a className="quick-filter-btn policy-link" href="https://dashboard.stripe.com/revenue_recovery/retries" target="_blank" rel="noreferrer">View retry policy <LuExternalLink /></a>
    </div>
    <div className="automation-notice"><LuCircleCheckBig /><div><strong>Stripe Billing handles collection</strong><p>No card checks or per-customer retry clicks. Some declines need a new payment method or customer authentication; those appear below.</p></div></div>
    <div className="recovery-tabs" role="group" aria-label="Invoice views">
      {[['open', 'Unpaid subscriptions'], ['paid', 'Paid after retries'], ['uncollectible', 'Recovery ended']].map(([value, label]) => <button key={value} className={`quick-filter-btn ${view === value ? 'selected-view' : ''}`} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}
      <button className="quick-filter-btn" onClick={refresh} disabled={loading}><LuRefreshCw /> {loading ? 'Refreshing…' : 'Refresh status'}</button>
    </div>
    <p className="scan-progress" role="status">{loading ? `Refreshing from Stripe · ${reviewed} invoices checked so far. Totals may change.` : error ? 'Refresh incomplete. Displayed results may be partial or out of date.' : `Up to date · ${reviewed} invoices checked.`} {updated && !loading && !error ? `Updated ${updated.toLocaleTimeString()}.` : ''}</p>
    <p className="scan-note">{view === 'open' ? 'All unpaid subscription invoices with a prior payment attempt, with no age cutoff.' : 'Subscription invoices created in the last 90 days. “Paid after retries” means multiple collection attempts; it is not a claim that this app recovered the payment.'} Status refreshes automatically every minute while this page is open.</p>
    {error && <div className="error-message" role="alert">{error}</div>}
    <div className="scorecards-grid recovery-metrics">
      <div className="scorecard"><div className="scorecard-value">{invoices.length}</div><div className="scorecard-label">{view === 'open' ? 'Unpaid invoices' : view === 'paid' ? 'Paid after multiple attempts' : 'Recovery ended'}</div></div>
      {view === 'open' && <><div className="scorecard"><div className="scorecard-value">{scheduled}</div><div className="scorecard-label">Next retry scheduled</div></div><div className="scorecard"><div className="scorecard-value">{needsAttention}</div><div className="scorecard-label">Need attention</div></div></>}
      <div className="scorecard"><div className="recovery-total">{Object.entries(totals).map(([currency, amount]) => <div key={currency}>{formatCurrency(amount, currency)} <small>{currency.toUpperCase()}</small></div>)}{!invoices.length && '—'}</div><div className="scorecard-label">{view === 'paid' ? 'Paid amount' : 'Outstanding amount'} · currencies kept separate</div></div>
    </div>
    <div className="table-container"><table className="transactions-table"><thead><tr><th>Customer</th><th>Invoice</th><th>{view === 'paid' ? 'Paid' : 'Outstanding'}</th><th>Recovery status</th><th>Attempts</th><th>{view === 'paid' ? 'Paid on' : 'Next automatic retry'}</th><th>Details</th></tr></thead><tbody>
      {!invoices.length && <tr><td colSpan="7"><div className="queue-empty"><h3>{loading ? 'Checking subscription invoices…' : error ? 'Invoice status is unavailable' : 'No matching invoices'}</h3><p>{loading ? 'Invoices appear as each batch arrives.' : 'Automatic retries keep running in Stripe according to your policy.'}</p></div></td></tr>}
      {invoices.map(invoice => <tr key={invoice.id}><td><span className="email">{invoice.email}</span></td><td><span className="invoice-number">{invoice.number}</span></td><td className="amount">{formatCurrency(invoice.amount, invoice.currency)} <small>{invoice.currency.toUpperCase()}</small></td><td><span className={`badge recovery-${invoice.state}`}>{labels[invoice.state]}</span><p className="recovery-reason">{invoice.explanation}</p></td><td>{invoice.attempts}</td><td>{view === 'paid' ? invoice.paidAt ? formatDate(invoice.paidAt) : 'Not reported' : invoice.nextAttempt ? formatDate(invoice.nextAttempt) : '—'}</td><td><a className="quick-filter-btn invoice-link" href={invoice.stripeUrl} target="_blank" rel="noreferrer">View invoice <LuExternalLink /></a></td></tr>)}
    </tbody></table></div>
  </div></main></div>;
}
