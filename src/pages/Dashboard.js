import React,{useState,useEffect,useRef,useCallback} from 'react';
import Sidebar from '../components/Sidebar';
import CustomerRecoveryDetails from '../components/CustomerRecoveryDetails';
import BalanceFigure from '../components/BalanceFigure';
import {LuArrowUpRight,LuPlay,LuCreditCard} from 'react-icons/lu';
import DateRangePicker,{rangePresets} from '../components/DateRangePicker';
import PreviewNavigation from '../components/PreviewNavigation';
import {studioQueueRequest,studioQueueRows} from './studioDemo';
import {paymentBatchRequest,formatCurrency,formatDate} from '../services/api';
import './Dashboard.css';
const stateLabel={pending:'Waiting',running:'Trying saved cards',paid:'Paid',failed:'All eligible cards failed',skipped:'Skipped',review:'Needs review'};
const failureDay=timestamp=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}).format(new Date(timestamp*1000));
const failureTime=timestamp=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(new Date(timestamp*1000));
const attemptLabel={pending:'Awaiting confirmed result',declined:'Declined',authentication_required:'Needs authentication',paid:'Paid',processing:'Payment processing',uncertain:'Uncertain — stopped'};
export default function Dashboard({preview=false}){
  const request=preview?studioQueueRequest:paymentBatchRequest;
  const [initialRange]=useState(()=>{const preset=rangePresets().find(item=>item.label==='Last 15 days');return {start:preset.start,end:preset.end};});
  const [start,setStart]=useState(initialRange.start),[end,setEnd]=useState(initialRange.end),[range,setRange]=useState(initialRange);
  const [rows,setRows]=useState(preview?studioQueueRows:[]),[loading,setLoading]=useState(false),[complete,setComplete]=useState(preview),[checked,setChecked]=useState(preview?studioQueueRows.length:0),[error,setError]=useState('');
  const [ready,setReady]=useState(preview);
  const [view,setView]=useState('unresolved');
  const [detailId,setDetailId]=useState(null);
  const closeDetails=useCallback(()=>setDetailId(null),[]);
  const [run,setRun]=useState(null),[attempts,setAttempts]=useState([]),[busy,setBusy]=useState(false),[usedSelection,setUsedSelection]=useState(false);
  const filterController=useRef(null),requestId=useRef(null),mounted=useRef(true);
  const running=run&&['running','stopping'].includes(run.status);
  const storeRun=useCallback(data=>{if(mounted.current){setRun(data.batch);setAttempts(data.attempts||[]);}},[]);
  const refreshRun=useCallback(async()=>{try{storeRun(await request('/latest'));}catch(err){if(mounted.current)setError(err.message);}},[storeRun,request]);
  useEffect(()=>{mounted.current=true;refreshRun();return()=>{mounted.current=false;filterController.current?.abort();};},[refreshRun]); // Status reads never start/resume a run.
  useEffect(()=>{if(!running)return;const timer=setInterval(refreshRun,3000);return()=>clearInterval(timer);},[running,refreshRun]);
  const applyDates=useCallback(async(selected)=>{
    if(selected.start>selected.end){setError('The start date must come before the end date.');return;}
    filterController.current?.abort();const controller=new AbortController();filterController.current=controller;
    setStart(selected.start);setEnd(selected.end);setLoading(true);setError('');setComplete(false);setReady(false);setRows([]);setChecked(0);setRange(selected);setUsedSelection(false);requestId.current=null;
    let cursor=null,phase='charges';const invoices=new Map();
    try{do{
      const params=new URLSearchParams({startDate:selected.start,endDate:selected.end,phase});if(cursor)params.set('cursor',cursor);
      const data=await request(`/failed?${params}`,{signal:controller.signal});
      if(controller.signal.aborted||!mounted.current)return;
      for(const row of data.invoices){const prior=invoices.get(row.id);const newest=!prior||row.lastFailure>=prior.lastFailure?row:prior;invoices.set(row.id,{...newest,lastFailure:Math.max(row.lastFailure,prior?.lastFailure||0),failedPayments:[...new Set([...(prior?.failedPayments||[]),...row.failedPayments])],payments:[...new Map([...(prior?.payments||[]),...(row.payments||[])].map(payment=>[payment.id,payment])).values()]});}
      setRows([...invoices.values()].sort((a,b)=>b.lastFailure-a.lastFailure));setChecked(previous=>previous+data.totalFetched);
      if(data.hasMore&&(!data.nextCursor||data.nextCursor===cursor))throw new Error('The scan could not advance. Apply the dates again.');
      cursor=data.nextCursor;if(!cursor&&data.nextPhase){phase=data.nextPhase;cursor=null;}else if(!cursor){phase=null;}
    }while(cursor||phase);
    const readiness=await request('/ready',{signal:controller.signal});
    if(controller.signal.aborted||!mounted.current)return;
    setReady(readiness.ready===true);setComplete(true);
    }catch(err){if(!controller.signal.aborted&&mounted.current)setError(err.message);}
    finally{if(filterController.current===controller&&mounted.current)setLoading(false);}
  },[request]);
  useEffect(()=>{if(!preview)applyDates(initialRange);},[preview,applyDates,initialRange]);
  const startRun=async()=>{
    if(preview)return;
    setBusy(true);setError('');
    if(!requestId.current)requestId.current=crypto.randomUUID();
    try{
      const data=await request('/start',{method:'POST',body:JSON.stringify({authorize:true,requestId:requestId.current,startDate:range.start,endDate:range.end,tokens:retryRows.map(row=>row.selectionToken)})});
      storeRun(data);setUsedSelection(true);
    }catch(err){if(mounted.current)setError(err.message);await refreshRun();}
    finally{if(mounted.current)setBusy(false);}
  };
  const controlRun=async(action)=>{if(preview)return;setBusy(true);setError('');try{storeRun(await request(`/${run._id}/${action}`,{method:'POST',body:JSON.stringify({authorize:true})}));}catch(err){if(mounted.current)setError(err.message);}finally{if(mounted.current)setBusy(false);}};
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
  const visiblePaid=visibleRows.filter(row=>row.displayStatus==='paid'||collectedThisRun(row)).length;
  const needsReview=visibleRows.length-retryRows.length-visiblePaid;
  const finished=(run?.items||[]).filter(item=>!['pending','running'].includes(item.state)).length;
  const detailRow=rows.find(row=>row.id===detailId);
  return <div className="dashboard-layout collection-desk" data-demo={preview}>{preview?<PreviewNavigation/>:<Sidebar/>}<main className="dashboard-content"><div className="container queue-workspace studio-queue">
    <header className="desk-page-heading"><div><span>Subscription collections</span><h1>Let’s recover what’s yours.</h1></div><DateRangePicker start={start} end={end} onApply={applyDates} disabled={loading||running||busy} allowAllTime={false}/></header>
    <section className="desk-collection-bar" aria-label="Collection run"><div className="desk-money"><span className="ready-label"><i/>{loading?'Finding outstanding invoices':'Ready to recover'}</span>{Object.keys(totals).length?Object.entries(totals).map(([currency,amount])=><strong key={currency}><BalanceFigure amount={amount} currency={currency}/><small>{currency.toUpperCase()}</small></strong>):<strong>—</strong>}<p>{loading?`${retryRows.length} invoices matched so far · Scan in progress`:complete?`${retryRows.length} invoices with eligible saved cards`:'Choose a date range to find failed payments'}</p></div>{complete&&visibleRows.length>0&&<div className="desk-selection-plan"><h2>In this selection</h2><div className="selection-track" role="img" aria-label={`${retryRows.length} included in retry, ${needsReview} for review, ${visiblePaid} paid`}><span className="track-ready" style={{width:`${retryRows.length/visibleRows.length*100}%`}}/><span className="track-review" style={{width:`${needsReview/visibleRows.length*100}%`}}/><span className="track-paid" style={{width:`${visiblePaid/visibleRows.length*100}%`}}/></div><div className="selection-key"><span><i className="key-ready"/>{retryRows.length} in retry</span><span><i className="key-review"/>{needsReview} for review</span>{visiblePaid>0&&<span><i className="key-paid"/>{visiblePaid} paid</span>}</div></div>}<div className="desk-run-action"><button className="desk-run-button" onClick={startRun} disabled={preview||!complete||!ready||!retryRows.length||retryRows.length>500||loading||running||busy||usedSelection}><LuPlay/>Retry filtered payments{complete?` (${retryRows.length})`:''}</button><p>{preview?'Preview workspace · Live collection disabled':'One attempt per card. Stops when paid.'}</p></div></section>
    <div className="queue-workbench"><div className="queue-main">
    {error&&<div className="error-message" role="alert">{error}</div>}
    {range&&<p className="scan-progress" role="status">{loading?'Scanning payments — partial results below.':complete?(ready?'Filter complete. Ready for your run.':'Filter complete.'):'Filter incomplete. Apply dates again before retrying.'} {checked.toLocaleString()} payments checked · {range.start} through {range.end}.</p>}
    {retryRows.length>500&&<p className="error-message">More than 500 unpaid invoices matched. Narrow the dates before starting a run.</p>}
    <div className="queue-table-bar desk-table-toolbar"><div className="failure-views" role="group" aria-label="Failure history views"><button className="quick-filter-btn" aria-pressed={view==='unresolved'} onClick={()=>setView('unresolved')}>Recovery queue ({queueRows.length})</button><button className="quick-filter-btn" aria-pressed={view==='all'} onClick={()=>setView('all')}>All failure history ({rows.length})</button></div><span className="desk-failure-counts">{failedCount} failed · {blockedCount} blocked · {paidCount} paid</span></div>
    <div className="table-container"><table className="transactions-table"><thead><tr><th>Customer</th><th>Amount due</th><th>Saved credit cards</th><th>Last failure in range</th><th>Failures in range</th><th>Collection status</th></tr></thead><tbody>
      {!visibleRows.length&&<tr><td colSpan="6"><div className="queue-empty"><h3>{loading?'Finding failed subscription payments…':complete?'No matching failures':'Choose a date range'}</h3><p>Applying dates only reads payments. Nothing is charged until you start a run.</p></div></td></tr>}
      {visibleRows.map(row=>{const item=sameRange?itemMap.get(row.id):null;const paid=collectedThisRun(row)||row.displayStatus==='paid';return <tr key={row.id} className={`${paid?'payment-row-paid':''} ${detailId===row.id?'desk-row-active':''}`}><td className="email"><button className="studio-customer desk-customer-button" onClick={()=>setDetailId(row.id)} aria-label={`View invoice for ${row.email}`}><span className="customer-initial" aria-hidden="true">{(row.email||'Customer').slice(0,1).toUpperCase()}</span><span className="desk-customer-copy">{row.email}<small className="customer-invoice">{row.number}</small></span><LuArrowUpRight className="customer-open-arrow"/></button></td><td className="amount">{formatCurrency(paid?0:(row.amount??row.failedAmount),row.currency)} <small>{row.currency.toUpperCase()}</small>{row.amount===null&&<p className="recovery-reason">Failed amount; current balance unavailable</p>}</td><td className="saved-card-count">{Number.isInteger(row.cardCount)?<><LuCreditCard className="card-count-icon"/><strong>{row.cardCount}</strong><span> saved</span>{row.eligibleCardCount!==row.cardCount&&<p className="recovery-reason">{row.eligibleCardCount} eligible for retry</p>}</>:<span title="The card count could not be loaded from Stripe">Unavailable</span>}</td><td className="desk-failure-date" title={formatDate(row.lastFailure)}><span>{failureDay(row.lastFailure)}</span><small>{failureTime(row.lastFailure)} · NY</small></td><td>{row.failedPayments.length}<p className="recovery-reason">{row.reason}</p></td><td>{item?<><span className={`badge run-state-${item.state}`}>{stateLabel[item.state]||item.state}</span><p className="recovery-reason">{item.attempts} card attempts{item.reason?` · ${item.reason.replaceAll('_',' ')}`:''}</p></>:paid?<span className="badge">Paid</span>:row.selectionToken?<span className="badge ready-badge">Ready to retry</span>:<><span>Not included in retry</span><p className="recovery-reason">{row.retryNote}</p></>}</td></tr>;})}
    </tbody></table></div>
    </div>
    {run&&<section className="profile-section batch-progress"><h2>Run: {run.status}</h2><p>{run.startDate} through {run.endDate} · {finished} of {run.items.length} invoices finished · {run.items.filter(item=>item.state==='paid').length} paid.</p>
      <p className="scan-note">This run contains a fixed invoice list. A restart never resumes charging by itself. Unknown payment outcomes are held for review.</p>
      {running&&<button className="quick-filter-btn" onClick={()=>controlRun('stop')} disabled={busy||run.status==='stopping'}>{run.status==='stopping'?'Stopping after the in-flight attempt…':'Stop remaining attempts'}</button>}
      {['interrupted','failed'].includes(run.status)&&run.items.some(item=>['pending','running'].includes(item.state))&&<button className="quick-filter-btn" onClick={()=>controlRun('resume')} disabled={busy}>Resume this run</button>}
      <button className="quick-filter-btn" onClick={refreshRun} disabled={busy}>Refresh run status</button>
      {usedSelection&&!running&&<p className="scan-note">Apply dates again to prepare a new explicit run. Cards are never automatically retried again.</p>}
      {run.lastError&&<p className="error-message">{run.lastError}</p>}
    </section>}
    </div>
    <div className="desk-table-footnote"><span>{visibleRows.length} invoices / payment records · {retryRows.length} included in retry</span><span>{writtenOffCount} written-off · {unavailableCount} unavailable</span></div>
    <details className="desk-collection-rules"><summary>How collection works</summary><p>One attempt per eligible saved card, including the default card. Stop on success or when every eligible card has failed. Applying dates only reads payments; there are no scheduled runs.</p></details>
    {attempts.length>0&&<details className="profile-section batch-attempts"><summary>Card-by-card results for this run <span>{attempts.length} attempts</span></summary><div className="table-container"><table className="transactions-table"><thead><tr><th>Invoice</th><th>Card</th><th>Amount</th><th>Result</th><th>Details</th></tr></thead><tbody>{attempts.map(attempt=><tr key={attempt._id}><td>{attempt.invoiceId}</td><td>{attempt.brand} •••• {attempt.last4}</td><td>{formatCurrency(attempt.amount,attempt.currency)}</td><td>{attemptLabel[attempt.status]||attempt.status}</td><td>{attempt.code?.replaceAll('_',' ')||'—'}</td></tr>)}</tbody></table></div></details>}
  </div></main>{detailRow&&<CustomerRecoveryDetails row={detailRow} item={sameRange?itemMap.get(detailRow.id):null} preview={preview} onClose={closeDetails}/>}</div>;
}
