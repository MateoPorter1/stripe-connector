import React,{useState,useEffect,useRef,useCallback} from 'react';
import Sidebar from '../components/Sidebar';
import {paymentBatchRequest,formatCurrency,formatDate} from '../services/api';
import './Dashboard.css';
const day=offset=>{const date=new Date();date.setUTCDate(date.getUTCDate()+offset);return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);};
const stateLabel={pending:'Waiting',running:'Trying saved cards',paid:'Paid',failed:'All eligible cards failed',skipped:'Skipped',review:'Needs review'};
const attemptLabel={pending:'Awaiting confirmed result',declined:'Declined',authentication_required:'Needs authentication',paid:'Paid',processing:'Payment processing',uncertain:'Uncertain — stopped'};
export default function Dashboard(){
  const [start,setStart]=useState(()=>day(-7)),[end,setEnd]=useState(()=>day(0)),[range,setRange]=useState(null);
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(false),[complete,setComplete]=useState(false),[checked,setChecked]=useState(0),[error,setError]=useState('');
  const [ready,setReady]=useState(false);
  const [view,setView]=useState('unresolved');
  const [run,setRun]=useState(null),[attempts,setAttempts]=useState([]),[busy,setBusy]=useState(false),[usedSelection,setUsedSelection]=useState(false);
  const filterController=useRef(null),requestId=useRef(null),mounted=useRef(true);
  const running=run&&['running','stopping'].includes(run.status);
  const storeRun=useCallback(data=>{if(mounted.current){setRun(data.batch);setAttempts(data.attempts||[]);}},[]);
  const refreshRun=useCallback(async()=>{try{storeRun(await paymentBatchRequest('/latest'));}catch(err){if(mounted.current)setError(err.message);}},[storeRun]);
  useEffect(()=>{mounted.current=true;refreshRun();return()=>{mounted.current=false;filterController.current?.abort();};},[refreshRun]); // Status reads never start/resume a run.
  useEffect(()=>{if(!running)return;const timer=setInterval(refreshRun,3000);return()=>clearInterval(timer);},[running,refreshRun]);
  const applyDates=async()=>{
    if(start>end){setError('The start date must come before the end date.');return;}
    filterController.current?.abort();const controller=new AbortController();filterController.current=controller;
    const selected={start,end};setLoading(true);setError('');setComplete(false);setReady(false);setRows([]);setChecked(0);setRange(selected);setUsedSelection(false);requestId.current=null;
    let cursor=null,phase='charges';const invoices=new Map();
    try{do{
      const params=new URLSearchParams({startDate:selected.start,endDate:selected.end,phase});if(cursor)params.set('cursor',cursor);
      const data=await paymentBatchRequest(`/failed?${params}`,{signal:controller.signal});
      if(controller.signal.aborted||!mounted.current)return;
      for(const row of data.invoices){const prior=invoices.get(row.id);const newest=!prior||row.lastFailure>=prior.lastFailure?row:prior;invoices.set(row.id,{...newest,lastFailure:Math.max(row.lastFailure,prior?.lastFailure||0),failedPayments:[...new Set([...(prior?.failedPayments||[]),...row.failedPayments])],payments:[...new Map([...(prior?.payments||[]),...(row.payments||[])].map(payment=>[payment.id,payment])).values()]});}
      setRows([...invoices.values()].sort((a,b)=>b.lastFailure-a.lastFailure));setChecked(previous=>previous+data.totalFetched);
      if(data.hasMore&&(!data.nextCursor||data.nextCursor===cursor))throw new Error('The scan could not advance. Apply the dates again.');
      cursor=data.nextCursor;if(!cursor&&data.nextPhase){phase=data.nextPhase;cursor=null;}else if(!cursor){phase=null;}
    }while(cursor||phase);
    const readiness=await paymentBatchRequest('/ready',{signal:controller.signal});
    if(controller.signal.aborted||!mounted.current)return;
    setReady(readiness.ready===true);setComplete(true);
    }catch(err){if(!controller.signal.aborted&&mounted.current)setError(err.message);}
    finally{if(filterController.current===controller&&mounted.current)setLoading(false);}
  };
  const startRun=async()=>{
    setBusy(true);setError('');
    if(!requestId.current)requestId.current=crypto.randomUUID();
    try{
      const data=await paymentBatchRequest('/start',{method:'POST',body:JSON.stringify({authorize:true,requestId:requestId.current,startDate:range.start,endDate:range.end,tokens:retryRows.map(row=>row.selectionToken)})});
      storeRun(data);setUsedSelection(true);
    }catch(err){if(mounted.current)setError(err.message);await refreshRun();}
    finally{if(mounted.current)setBusy(false);}
  };
  const controlRun=async(action)=>{setBusy(true);setError('');try{storeRun(await paymentBatchRequest(`/${run._id}/${action}`,{method:'POST',body:JSON.stringify({authorize:true})}));}catch(err){if(mounted.current)setError(err.message);}finally{if(mounted.current)setBusy(false);}};
  const itemMap=new Map((run?.items||[]).map(item=>[item.invoiceId,item]));
  const sameRange=run&&range&&run.startDate===range.start&&run.endDate===range.end;
  const collectedThisRun=row=>Boolean(sameRange&&itemMap.get(row.id)?.state==='paid');
  const queueRows=rows.filter(row=>row.displayStatus!=='paid'||collectedThisRun(row));
  const visibleRows=view==='all'?rows:queueRows;
  const retryRows=visibleRows.filter(row=>row.selectionToken&&!collectedThisRun(row)&&row.displayStatus!=='paid');
  const paymentRecords=[...new Map(rows.flatMap(row=>row.payments||[]).map(payment=>[payment.id,payment])).values()];
  const failedCount=paymentRecords.filter(payment=>payment.state==='failed').length;
  const blockedCount=paymentRecords.filter(payment=>payment.state==='blocked').length;
  const paidCount=rows.filter(row=>row.displayStatus==='paid').length;
  const writtenOffCount=rows.filter(row=>row.displayStatus==='written_off').length;
  const unavailableCount=rows.filter(row=>row.displayStatus==='unavailable').length;
  const totals=retryRows.reduce((all,row)=>({...all,[row.currency]:(all[row.currency]||0)+row.amount}),{});
  const finished=(run?.items||[]).filter(item=>!['pending','running'].includes(item.state)).length;
  return <div className="dashboard-layout"><Sidebar/><main className="dashboard-content"><div className="container queue-workspace studio-queue">
    <header className="queue-masthead"><div><span className="workspace-location">Your workspace / Collections</span><h1>Recovery queue</h1><p>Review failed subscriptions. Collect outstanding revenue.</p></div><a className="queue-history-link" href="/home">View collected revenue ↗</a></header>
    <section className="filter-section"><div className="date-filters">
      <div className="date-input-group"><label htmlFor="startDate">Failed from</label><input id="startDate" type="date" value={start} onChange={event=>setStart(event.target.value)} disabled={loading||running} className="date-input"/></div>
      <div className="date-input-group"><label htmlFor="endDate">Failed through</label><input id="endDate" type="date" value={end} onChange={event=>setEnd(event.target.value)} disabled={loading||running} className="date-input"/></div>
      <button className="search-button" onClick={applyDates} disabled={loading||running||busy}>{loading?'Finding failed payments…':'Apply dates'}</button>
    </div><details className="collection-rules"><summary>How collection works</summary><p>Failure dates use New York time. Repeat attempts on one invoice appear in one row. Written-off, blocked and unavailable invoices stay visible for review.</p><p>Each unpaid subscription invoice is handled in order. Each distinct eligible saved card gets one attempt, including the default card. We stop on success or after all cards fail. There are no scheduled runs.</p></details></section>
    <div className="queue-workbench"><div className="queue-main">
    {error&&<div className="error-message" role="alert">{error}</div>}
    {range&&<p className="scan-progress" role="status">{loading?'Scanning payments — partial results below.':complete?(ready?'Filter complete. Ready for your run.':'Filter complete.'):'Filter incomplete. Apply dates again before retrying.'} {checked.toLocaleString()} payments checked · {range.start} through {range.end}.</p>}
    {retryRows.length>500&&<p className="error-message">More than 500 unpaid invoices matched. Narrow the dates before starting a run.</p>}
    {range&&<section className="queue-counts" aria-label="Failure counts"><div><strong>{failedCount}</strong><span>failed payments</span></div><div><strong>{blockedCount}</strong><span>blocked</span></div><div><strong>{paidCount}</strong><span>paid after failure</span></div><p>{writtenOffCount} written-off · {unavailableCount} unavailable</p></section>}
    <div className="queue-table-bar"><div className="failure-views" role="group" aria-label="Failure history views"><button className="quick-filter-btn" aria-pressed={view==='unresolved'} onClick={()=>setView('unresolved')}>Recovery queue ({queueRows.length})</button><button className="quick-filter-btn" aria-pressed={view==='all'} onClick={()=>setView('all')}>All failure history ({rows.length})</button></div><span>Grouped by invoice</span></div>
    <div className="workspace-heading"><h2>{visibleRows.length} invoices / payment records · {retryRows.length} included in retry</h2><div>{Object.entries(totals).map(([currency,amount])=><span className="batch-currency" key={currency}>{formatCurrency(amount,currency)} {currency.toUpperCase()}</span>)}</div></div>
    <div className="table-container"><table className="transactions-table"><thead><tr><th>Customer</th><th>Invoice</th><th>Balance / failed amount</th><th>Saved credit cards</th><th>Last failure in range</th><th>Failures in range</th><th>This run</th></tr></thead><tbody>
      {!visibleRows.length&&<tr><td colSpan="7"><div className="queue-empty"><h3>{loading?'Finding failed subscription payments…':complete?'No matching failures':'Choose a date range'}</h3><p>Applying dates only reads payments. Nothing is charged until you start a run.</p></div></td></tr>}
      {visibleRows.map(row=>{const item=sameRange?itemMap.get(row.id):null;const paid=collectedThisRun(row)||row.displayStatus==='paid';return <tr key={row.id} className={paid?'payment-row-paid':undefined}><td className="email"><span className="studio-customer"><span className="customer-initial" aria-hidden="true">{(row.email||'Customer').slice(0,1).toUpperCase()}</span><span>{row.email}</span></span></td><td>{row.number}<p className="recovery-reason"><a href={`https://dashboard.stripe.com/payments/${row.payments?.[0]?.id||row.id}`} target="_blank" rel="noreferrer">View in Stripe</a></p></td><td className="amount">{formatCurrency(paid?0:(row.amount??row.failedAmount),row.currency)} <small>{row.currency.toUpperCase()}</small>{row.amount===null&&<p className="recovery-reason">Failed amount; current balance unavailable</p>}</td><td className="saved-card-count">{Number.isInteger(row.cardCount)?<><strong>{row.cardCount}</strong><span> saved</span>{row.eligibleCardCount!==row.cardCount&&<p className="recovery-reason">{row.eligibleCardCount} eligible for retry</p>}</>:<span title="The card count could not be loaded from Stripe">Unavailable</span>}</td><td>{formatDate(row.lastFailure)}</td><td>{row.failedPayments.length}<p className="recovery-reason">{row.reason}</p></td><td>{item?<><span className="badge">{stateLabel[item.state]||item.state}</span><p className="recovery-reason">{item.attempts} card attempts{item.reason?` · ${item.reason.replaceAll('_',' ')}`:''}</p></>:paid?<span className="badge">Paid</span>:row.selectionToken?'Ready to retry':<><span>Not included in retry</span><p className="recovery-reason">{row.retryNote}</p></>}</td></tr>;})}
    </tbody></table></div>
    </div><aside className="collection-console"><section className="run-launcher"><span className="console-label">Collection run</span><h2>{complete?`${retryRows.length} invoices ready`:'Prepare a collection'}</h2><div className="console-balance">{Object.entries(totals).length?Object.entries(totals).map(([currency,amount])=><strong key={currency}>{formatCurrency(amount,currency)} <small>{currency.toUpperCase()}</small></strong>):<strong>—</strong>}<span>Outstanding in this selection</span></div><p>{range?`${range.start} through ${range.end}`:'Apply a date range to find failed subscription payments.'}</p>
      <button className="auth-button batch-start-button" onClick={startRun} disabled={!complete||!ready||!retryRows.length||retryRows.length>500||loading||running||busy||usedSelection}>Retry filtered payments{complete?` (${retryRows.length})`:''}</button><p className="console-disclosure">Starts real collections. One attempt per saved card, stopping when the invoice is paid.</p></section>
    {run&&<section className="profile-section batch-progress"><h2>Run: {run.status}</h2><p>{run.startDate} through {run.endDate} · {finished} of {run.items.length} invoices finished · {run.items.filter(item=>item.state==='paid').length} paid.</p>
      <p className="scan-note">This run contains a fixed invoice list. A restart never resumes charging by itself. Unknown payment outcomes are held for review.</p>
      {running&&<button className="quick-filter-btn" onClick={()=>controlRun('stop')} disabled={busy||run.status==='stopping'}>{run.status==='stopping'?'Stopping after the in-flight attempt…':'Stop remaining attempts'}</button>}
      {['interrupted','failed'].includes(run.status)&&run.items.some(item=>['pending','running'].includes(item.state))&&<button className="quick-filter-btn" onClick={()=>controlRun('resume')} disabled={busy}>Resume this run</button>}
      <button className="quick-filter-btn" onClick={refreshRun} disabled={busy}>Refresh run status</button>
      {usedSelection&&!running&&<p className="scan-note">Apply dates again to prepare a new explicit run. Cards are never automatically retried again.</p>}
      {run.lastError&&<p className="error-message">{run.lastError}</p>}
    </section>}
    </aside></div>
    {attempts.length>0&&<details className="profile-section batch-attempts"><summary>Card-by-card results for this run <span>{attempts.length} attempts</span></summary><div className="table-container"><table className="transactions-table"><thead><tr><th>Invoice</th><th>Card</th><th>Amount</th><th>Result</th><th>Details</th></tr></thead><tbody>{attempts.map(attempt=><tr key={attempt._id}><td>{attempt.invoiceId}</td><td>{attempt.brand} •••• {attempt.last4}</td><td>{formatCurrency(attempt.amount,attempt.currency)}</td><td>{attemptLabel[attempt.status]||attempt.status}</td><td>{attempt.code?.replaceAll('_',' ')||'—'}</td></tr>)}</tbody></table></div></details>}
  </div></main></div>;
}
