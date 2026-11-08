import React,{useState,useEffect,useRef,useCallback} from 'react';
import Sidebar from '../components/Sidebar';
import RecoveryBanner from '../components/RecoveryBanner';
import {paymentBatchRequest,formatCurrency,formatDate} from '../services/api';
import './Dashboard.css';
const day=offset=>{const date=new Date();date.setUTCDate(date.getUTCDate()+offset);return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);};
const stateLabel={pending:'Waiting',running:'Trying saved cards',paid:'Paid',failed:'All eligible cards failed',skipped:'Skipped',review:'Needs review'};
const attemptLabel={pending:'Awaiting confirmed result',declined:'Declined',authentication_required:'Needs authentication',paid:'Paid',processing:'Payment processing',uncertain:'Uncertain — stopped'};
export default function Dashboard(){
  const [start,setStart]=useState(()=>day(-7)),[end,setEnd]=useState(()=>day(0)),[range,setRange]=useState(null);
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(false),[complete,setComplete]=useState(false),[checked,setChecked]=useState(0),[error,setError]=useState('');
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
    const selected={start,end};setLoading(true);setError('');setComplete(false);setRows([]);setChecked(0);setRange(selected);setUsedSelection(false);requestId.current=null;
    let cursor=null;const invoices=new Map();
    try{do{
      const params=new URLSearchParams({startDate:selected.start,endDate:selected.end});if(cursor)params.set('cursor',cursor);
      const data=await paymentBatchRequest(`/failed?${params}`,{signal:controller.signal});
      if(controller.signal.aborted||!mounted.current)return;
      for(const row of data.invoices){const prior=invoices.get(row.id);invoices.set(row.id,{...row,lastFailure:Math.max(row.lastFailure,prior?.lastFailure||0),failedPayments:[...new Set([...(prior?.failedPayments||[]),...row.failedPayments])]});}
      setRows([...invoices.values()].sort((a,b)=>b.lastFailure-a.lastFailure));setChecked(previous=>previous+data.totalFetched);
      if(data.hasMore&&(!data.nextCursor||data.nextCursor===cursor))throw new Error('The scan could not advance. Apply the dates again.');
      cursor=data.nextCursor;
    }while(cursor);setComplete(true);
    }catch(err){if(!controller.signal.aborted&&mounted.current)setError(err.message);}
    finally{if(filterController.current===controller&&mounted.current)setLoading(false);}
  };
  const startRun=async()=>{
    setBusy(true);setError('');
    if(!requestId.current)requestId.current=crypto.randomUUID();
    try{
      const data=await paymentBatchRequest('/start',{method:'POST',body:JSON.stringify({authorize:true,requestId:requestId.current,startDate:range.start,endDate:range.end,tokens:rows.map(row=>row.selectionToken)})});
      storeRun(data);setUsedSelection(true);
    }catch(err){if(mounted.current)setError(err.message);await refreshRun();}
    finally{if(mounted.current)setBusy(false);}
  };
  const controlRun=async(action)=>{setBusy(true);setError('');try{storeRun(await paymentBatchRequest(`/${run._id}/${action}`,{method:'POST',body:JSON.stringify({authorize:true})}));}catch(err){if(mounted.current)setError(err.message);}finally{if(mounted.current)setBusy(false);}};
  const totals=rows.reduce((all,row)=>({...all,[row.currency]:(all[row.currency]||0)+row.amount}),{});
  const itemMap=new Map((run?.items||[]).map(item=>[item.invoiceId,item]));
  const sameRange=run&&range&&run.startDate===range.start&&run.endDate===range.end;
  const finished=(run?.items||[]).filter(item=>!['pending','running'].includes(item.state)).length;
  return <div className="dashboard-layout"><Sidebar/><main className="dashboard-content"><div className="container">
    <RecoveryBanner title="Choose the dates. Retry the payments." subtitle="One button starts one run. Each unpaid subscription invoice is handled in order, with one attempt per saved card until a payment succeeds."/>
    <div className="workspace-heading"><div><h1>Failed subscription payments</h1><p>Filter failures first. You decide when a retry run starts.</p></div></div>
    <section className="filter-section"><div className="date-filters">
      <div className="date-input-group"><label htmlFor="startDate">Failed from</label><input id="startDate" type="date" value={start} onChange={event=>setStart(event.target.value)} disabled={loading||running} className="date-input"/></div>
      <div className="date-input-group"><label htmlFor="endDate">Failed through</label><input id="endDate" type="date" value={end} onChange={event=>setEnd(event.target.value)} disabled={loading||running} className="date-input"/></div>
      <button className="search-button" onClick={applyDates} disabled={loading||running||busy}>{loading?'Finding failed payments…':'Apply dates'}</button>
      <button className="auth-button batch-start-button" onClick={startRun} disabled={!complete||!rows.length||rows.length>500||loading||running||busy||usedSelection}>Retry filtered payments{complete?` (${rows.length})`:''}</button>
    </div><p className="scan-note">Failure dates use New York time. Rows show subscription invoices still unpaid, with at least one failed charge in that range. Multiple failures on the same invoice appear as one debt.</p>
    <p className="scan-note">“Retry filtered payments” starts real collections for exactly these invoices. The first/default card is included. Each distinct eligible card gets one attempt in this run. There are no scheduled runs.</p></section>
    {error&&<div className="error-message" role="alert">{error}</div>}
    {range&&<p className="scan-progress" role="status">{loading?'Scanning payments — partial results below.':complete?'Filter complete.':'Filter incomplete. Apply dates again before retrying.'} {checked.toLocaleString()} payments checked · {range.start} through {range.end}.</p>}
    {rows.length>500&&<p className="error-message">More than 500 unpaid invoices matched. Narrow the dates before starting a run.</p>}
    {run&&<section className="profile-section batch-progress"><h2>Run: {run.status}</h2><p>{run.startDate} through {run.endDate} · {finished} of {run.items.length} invoices finished · {run.items.filter(item=>item.state==='paid').length} paid.</p>
      <p className="scan-note">This run contains a fixed invoice list. A restart never resumes charging by itself. Unknown payment outcomes are held for review.</p>
      {running&&<button className="quick-filter-btn" onClick={()=>controlRun('stop')} disabled={busy||run.status==='stopping'}>{run.status==='stopping'?'Stopping after the in-flight attempt…':'Stop remaining attempts'}</button>}
      {['interrupted','failed'].includes(run.status)&&run.items.some(item=>['pending','running'].includes(item.state))&&<button className="quick-filter-btn" onClick={()=>controlRun('resume')} disabled={busy}>Resume this run</button>}
      <button className="quick-filter-btn" onClick={refreshRun} disabled={busy}>Refresh run status</button>
      {usedSelection&&!running&&<p className="scan-note">Apply dates again to prepare a new explicit run. Cards are never automatically retried again.</p>}
      {run.lastError&&<p className="error-message">{run.lastError}</p>}
    </section>}
    <div className="workspace-heading"><h2>{rows.length} unpaid invoices</h2><div>{Object.entries(totals).map(([currency,amount])=><span className="batch-currency" key={currency}>{formatCurrency(amount,currency)} {currency.toUpperCase()}</span>)}</div></div>
    <div className="table-container"><table className="transactions-table"><thead><tr><th>Customer</th><th>Invoice</th><th>Still due</th><th>Last failure in range</th><th>Failures in range</th><th>This run</th></tr></thead><tbody>
      {!rows.length&&<tr><td colSpan="6"><div className="queue-empty"><h3>{loading?'Finding failed subscription payments…':complete?'No matching unpaid invoices':'Choose a date range'}</h3><p>Applying dates only reads payments. Nothing is charged until you start a run.</p></div></td></tr>}
      {rows.map(row=>{const item=sameRange?itemMap.get(row.id):null;return <tr key={row.id}><td className="email">{row.email}</td><td>{row.number}</td><td className="amount">{formatCurrency(row.amount,row.currency)} <small>{row.currency.toUpperCase()}</small></td><td>{formatDate(row.lastFailure)}</td><td>{row.failedPayments.length}<p className="recovery-reason">{row.reason}</p></td><td>{item?<><span className="badge">{stateLabel[item.state]||item.state}</span><p className="recovery-reason">{item.attempts} card attempts{item.reason?` · ${item.reason.replaceAll('_',' ')}`:''}</p></>:'Not run'}</td></tr>;})}
    </tbody></table></div>
    {attempts.length>0&&<section className="profile-section batch-attempts"><h2>Card-by-card results for this run</h2><div className="table-container"><table className="transactions-table"><thead><tr><th>Invoice</th><th>Card</th><th>Amount</th><th>Result</th><th>Details</th></tr></thead><tbody>{attempts.map(attempt=><tr key={attempt._id}><td>{attempt.invoiceId}</td><td>{attempt.brand} •••• {attempt.last4}</td><td>{formatCurrency(attempt.amount,attempt.currency)}</td><td>{attemptLabel[attempt.status]||attempt.status}</td><td>{attempt.code?.replaceAll('_',' ')||'—'}</td></tr>)}</tbody></table></div></section>}
  </div></main></div>;
}
