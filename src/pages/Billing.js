import React,{useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {billingRequest,billingDestination} from '../services/billing';
import './Billing.css';
const demo={configured:true,plan:{name:'Rebound monthly',amount:100,currency:'usd',interval:'month'},billing:{mode:'test',status:'none',hasCustomer:false,liveAccessChanged:false}};
export default function Billing({preview=false}){
 const [params]=useSearchParams(),[data,setData]=useState(preview?demo:null),[loading,setLoading]=useState(!preview),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const session=params.get('session_id'),returned=params.get('checkout');
 useEffect(()=>{if(preview)return;let current=true;setLoading(true);setError('');
  const request=returned==='success'&&session?billingRequest('/confirm',{sessionId:session}):billingRequest();
  request.then(result=>{if(current)setData(result);}).catch(e=>{if(current)setError(e.name==='TimeoutError'?'Billing took too long. Please refresh.':e.message);}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};
 },[preview,returned,session]);
 async function open(path){setBusy(true);setError('');try{const result=await billingRequest(path,{});window.location.assign(billingDestination(result.url));}catch(e){setError(e.message);setBusy(false);}}
 const billing=data?.billing,plan=data?.plan,exists=billing&&['active','trialing','past_due','unpaid','paused','incomplete'].includes(billing.status);
 const money=plan?new Intl.NumberFormat('en-US',{style:'currency',currency:plan.currency.toUpperCase()}).format(plan.amount/100):'';
 const status={none:'No test subscription',active:'Test subscription active',trialing:'Test trial active',past_due:'Test payment overdue',unpaid:'Test payment unpaid',canceled:'Test subscription cancelled',incomplete:'Test payment incomplete',incomplete_expired:'Test checkout expired',paused:'Test subscription paused'}[billing?.status]||'Checking subscription';
 return <div className="profile-layout"><Sidebar/><main className="billing-page"><Link className="billing-back" to="/profile">← Workspace settings</Link><header><span className="billing-eyebrow">Subscription & billing</span><h1>Your Rebound subscription.</h1><p>Manage the subscription you pay to Rebound.</p></header><div className="billing-test-notice"><strong>Test environment</strong><p>Payments here use test cards and move no real money. This does not change access to your live recovery workspace.</p></div>
 {error&&<div className="billing-error" role="alert">{error}<button onClick={()=>window.location.reload()}>Refresh billing</button></div>}
 {loading?<p role="status">Loading your subscription…</p>:data?.configured===false?<section className="billing-card"><h2>Subscription testing is being prepared.</h2><p>Your workspace is available. A monthly plan will appear here when test billing is configured.</p></section>:data&&<section className="billing-card"><div><span className="billing-eyebrow">Monthly subscription · test only</span><h2>Rebound monthly</h2><p>Review unpaid invoices, start a recovery run, and trace the result.</p></div><div className="billing-price"><strong>{money}</strong><span> / month · {plan.currency.toUpperCase()}</span><p>Illustrative test amount. Launch pricing has not been set.</p></div><div className="billing-state"><span>{status}</span>{billing.currentPeriodEnd&&<p>{billing.cancelAtPeriodEnd?'Scheduled to end':'Current period ends'} {new Date(billing.currentPeriodEnd).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</p>}</div>
 {returned==='cancelled'&&<p className="billing-help">Checkout was cancelled. No new subscription has been confirmed.</p>}
 {returned==='success'&&billing.status!=='active'&&<p className="billing-help">Checkout returned. We are checking Stripe for the payment outcome. A return to this page alone does not confirm payment.</p>}
 <div className="billing-actions">{!exists&&<button disabled={busy||preview} onClick={()=>open('/checkout')}>{busy?'Opening Stripe…':'Start test subscription →'}</button>}{billing.hasCustomer&&<button className="billing-secondary" disabled={busy||preview} onClick={()=>open('/portal')}>{busy?'Opening Stripe…':'Manage test subscription ↗'}</button>}<button className="billing-secondary" disabled={busy||preview} onClick={()=>window.location.reload()}>Refresh status</button></div><p className="billing-help">Stripe hosts checkout and subscription management. Your clients’ recovery API keys are never used to bill your Rebound subscription.</p>{preview&&<p className="billing-help">Design preview. Checkout is disabled.</p>}</section>}
 </main></div>;
}
