import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fallbackRequest, formatCurrency } from '../services/api';
const statuses = { pending:'Submission pending review', declined:'Card declined', paid:'Invoice paid', processing:'Payment processing', action_required:'Customer authentication needed', uncertain:'Outcome needs review', skipped:'Previously failed in Stripe — not charged by this tool' };
export default function CardFallback() {
  const [data,setData]=useState(null),[preview,setPreview]=useState(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const mounted=useRef(true);
  const load=useCallback(async()=>{ try { const result=await fallbackRequest(); if(mounted.current)setData(result); }catch(err){if(mounted.current)setError(err.message);} },[]);
  useEffect(()=>{mounted.current=true;load();const timer=setInterval(load,30000);return()=>{mounted.current=false;clearInterval(timer);};},[load]);
  const inspect=async()=>{setBusy(true);setError('');try{const result=await fallbackRequest('/preview');if(mounted.current)setPreview(result);}catch(err){if(mounted.current)setError(err.message);}finally{if(mounted.current)setBusy(false);}};
  const toggle=async(enabled)=>{setBusy(true);setError('');try{await fallbackRequest('',{method:'PUT',body:JSON.stringify({enabled,authorizeSavedCards:consent,accountId:preview?.account?.id})});await load();}catch(err){if(mounted.current)setError(err.message);}finally{if(mounted.current)setBusy(false);}};
  const enabled=data?.settings?.enabled===true;
  return <section className="fallback-panel profile-section">
    <div className="workspace-heading"><div><h2>Automatic card fallback</h2><p>This tool tries alternate saved cards when a subscription invoice payment fails.</p></div><span className={`badge ${enabled?'recovery-scheduled':''}`}>{enabled?'Enabled':'Paused'}</span></div>
    <p className="scan-note">One attempt per eligible card per invoice. Duplicate cards and expired cards are skipped. Stops when paid, processing, or authentication is required. Paused collection and canceled subscriptions stay excluded.</p>
    <p className="scan-note">Runs on the server with your browser closed. It checks small batches every minute while awake; an hourly scheduled wake resumes it after the free host sleeps. Scheduling can be delayed.</p>
    {!enabled && <div className="fallback-setup"><button className="quick-filter-btn" onClick={inspect} disabled={busy}>Preview eligible invoices — no charges</button>
      {preview && <div className="fallback-preview"><p><strong>Connected account: {preview.account.name}</strong></p><p>Sample of the five newest open invoices. Enabling covers all eligible open subscription invoices, including future failures.</p>
        <ul>{preview.invoices.map(invoice=><li key={invoice.id}>{invoice.number || invoice.id}: {formatCurrency(invoice.amount,invoice.currency)} · {invoice.reason ? invoice.reason.replaceAll('_',' ') : `${invoice.alternateCards.length} alternate saved card(s)`}</li>)}</ul>
        <label className="fallback-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> I authorize automatic collection of unpaid subscription invoices on this account using eligible saved cards that customers authorized for this use.</label>
        <button className="auth-button" disabled={busy||!consent} onClick={()=>toggle(true)}>Enable automatic card fallback — starts live collection</button>
      </div>}
    </div>}
    {enabled && <button className="quick-filter-btn" onClick={()=>toggle(false)} disabled={busy}>Pause automatic card fallback</button>}
    {data?.settings?.lastRunAt && <p className="scan-note">Last worker pass: {new Date(data.settings.lastRunAt).toLocaleString()} · {data.settings.lastSummary?.attempts || 0} card attempts in that pass.</p>}
    {data?.settings?.lastError && <p className="error-message">{data.settings.lastError}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <h3 className="fallback-log-title">This tool’s latest card attempts</h3>
    {!data?.attempts?.length ? <p className="scan-note">No card fallback attempts recorded. Previewing and viewing invoices do not charge customers.</p> : <div className="table-container"><table className="transactions-table"><thead><tr><th>Invoice</th><th>Card</th><th>Invoice amount</th><th>Result</th><th>When</th></tr></thead><tbody>{data.attempts.map(attempt=><tr key={attempt._id}><td>{attempt.invoiceId}</td><td>{attempt.brand} •••• {attempt.last4}</td><td>{formatCurrency(attempt.amount,attempt.currency)}</td><td>{statuses[attempt.status]}{attempt.code && <p className="recovery-reason">{attempt.code.replaceAll('_',' ')}</p>}</td><td>{new Date(attempt.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
  </section>;
}
