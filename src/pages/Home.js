import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import PreviewNavigation from '../components/PreviewNavigation';
import DateRangePicker from '../components/DateRangePicker';
import { LuArrowUpRight, LuInbox } from 'react-icons/lu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {statsRequest} from '../services/api';
import {studioDemoRequest} from './studioDemo';
import './Home.css';

const monthKey=row=>`${row.year}-${String(row.monthNumber).padStart(2,'0')}`;
const money=(cents,currency)=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(cents/100);
const collectedDate=date=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(date));

function CollectionTooltip({active,payload,label}) {
  if(!active||!payload?.length)return null;
  const month=payload[0].payload;
  return <div className="collection-tooltip"><div><span className="collection-tooltip-dot"/>{label}</div><strong>{money(Math.round(month.amount*100),'USD')}</strong><span>{month.count} recovered payments</span></div>;
}

function Home({preview=false}) {
  const request=preview?studioDemoRequest:statsRequest;
  const [palette,setPalette]=useState('teal');
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCurrency] = useState('USD');

  const [error,setError]=useState('');
  const [appliedRange,setAppliedRange]=useState({start:null,end:null});
  const [selectedMonth,setSelectedMonth]=useState(null);
  const [history,setHistory]=useState(null);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [historyError,setHistoryError]=useState('');
  const dataController=useRef(null),historyController=useRef(null),historySection=useRef(null);

  const fetchData = React.useCallback(async (start=null,end=null)=>{
    dataController.current?.abort();historyController.current?.abort();
    const controller=new AbortController();dataController.current=controller;
    setLoading(true);setError('');setSelectedMonth(null);setHistory(null);setHistoryError('');setHistoryLoading(false);
    const params=new URLSearchParams();if(start)params.set('startDate',start);if(end)params.set('endDate',end);
    const monthlyParams=new URLSearchParams(params);monthlyParams.set('currency',selectedCurrency);
    try{
      const [totals,monthly]=await Promise.all([request(`/summary?${params}`,{signal:controller.signal}),request(`/by-month?${monthlyParams}`,{signal:controller.signal})]);
      if(controller.signal.aborted)return;
      setSummary(totals.summary);setMonthlyData(monthly.data||[]);setAppliedRange({start,end});
    }catch(err){if(!controller.signal.aborted){setError(err.message);setSummary(null);setMonthlyData([]);}}
    finally{if(!controller.signal.aborted)setLoading(false);}
  },[selectedCurrency,request]);
  useEffect(()=>{fetchData();return()=>{dataController.current?.abort();historyController.current?.abort();};},[fetchData]);
  useEffect(()=>{if(selectedMonth)historySection.current?.scrollIntoView?.({behavior:'smooth',block:'start'});},[selectedMonth]);

  const loadHistory=async(month,cursor=null)=>{
    historyController.current?.abort();const controller=new AbortController();historyController.current=controller;
    const key=monthKey(month);setSelectedMonth(month);setHistoryLoading(true);setHistoryError('');if(!cursor)setHistory(null);
    const params=new URLSearchParams({month:key,currency:selectedCurrency});
    if(appliedRange.start)params.set('startDate',appliedRange.start);if(appliedRange.end)params.set('endDate',appliedRange.end);if(cursor)params.set('cursor',cursor);
    try{
      const data=await request(`/recoveries?${params}`,{signal:controller.signal});
      if(controller.signal.aborted)return;
      setHistory(previous=>({...data,recoveries:cursor?[...new Map([...(previous?.recoveries||[]),...data.recoveries].map(row=>[row._id,row])).values()]:data.recoveries}));
    }catch(err){if(!controller.signal.aborted)setHistoryError(err.message);}
    finally{if(!controller.signal.aborted)setHistoryLoading(false);}
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getMainCurrencyTotal = () => {
    if (!summary || !summary.totalsByCurrency) return 0;
    const mainCurrencyData = summary.totalsByCurrency[selectedCurrency];
    return mainCurrencyData ? mainCurrencyData.totalAmount / 100 : 0;
  };

  const getMainCurrencyCount = () => {
    if (!summary || !summary.totalsByCurrency) return 0;
    const mainCurrencyData = summary.totalsByCurrency[selectedCurrency];
    return mainCurrencyData ? mainCurrencyData.count : 0;
  };

  const formatLastRecoveryTime = (date) => {
    if (!date) return 'N/A';
    const now = new Date();
    const recoveryDate = new Date(date);
    const diffInMs = now - recoveryDate;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return 'Less than 1h ago';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  if (loading) {
    return (
      <div className="home-layout" data-palette={palette}>
        {preview?<PreviewNavigation/>:<Sidebar /> }
        <div className="home-content">
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Loading statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-layout" data-palette={palette}>
      {preview?<PreviewNavigation/>:<Sidebar /> }
      <div className="home-content">
        <div className="home-container overview-workspace studio-workspace">
          <header className="overview-masthead"><div><span className="workspace-location">{preview?'Design preview / Demo data':'Revenue recovery'}</span><h1>Recovery overview</h1></div><a className="open-queue" href={preview?'/design-preview/queue':'/dashboard'}>Open recovery queue <LuArrowUpRight/></a></header>
          <div className="overview-filterbar"><DateRangePicker start={startDate} end={endDate} onApply={range=>{setStartDate(range.start);setEndDate(range.end);fetchData(range.start,range.end);}}/>{preview&&<div className="palette-comparison" role="group" aria-label="Preview accent color"><span>Accent</span>{[['teal','Teal'],['amber','Amber'],['ice','Ice blue']].map(([id,label])=><button key={id} className={`palette-choice palette-${id}`} aria-pressed={palette===id} onClick={()=>setPalette(id)}><i aria-hidden="true"/>{label}</button>)}</div>}</div>
          {error&&<p className="error-message" role="alert">{error}</p>}
          <div className="overview-analysis">
          {/* Chart Section */}
          <div className="chart-section studio-performance">
            <div className="studio-performance-total"><span>Revenue recovered</span><span className="collection-currency">USD</span><strong>{formatCurrency(getMainCurrencyTotal(), selectedCurrency)}</strong><p>Collected through this workspace</p></div>
            <div className="analysis-heading"><div><h2>Monthly collections</h2></div><span>USD</span></div>

            
            {monthlyData.length === 0 ? (
              <div className="empty-chart-state">
                <p className="empty-icon"><LuInbox size={64} /></p>
                <h3>No data to display</h3>
                <p>Recover your first payment to see statistics here</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData} margin={{ top: 18, right: 10, left: 0, bottom: 5 }}>
                  <defs><linearGradient id="collection-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-top)"/><stop offset="100%" stopColor="var(--chart-base)"/></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#ffffff" strokeOpacity={0.07} />
                  <XAxis
                    dataKey="month"
                    tick={({x,y,payload})=>{const month=monthlyData.find(item=>item.month===payload.value);return <text x={x} y={y} dy={20} textAnchor="middle" fill="#9caab2" role="button" tabIndex={0} aria-label={`View payments for ${payload.value}`} style={{cursor:'pointer',fontSize:12,fontWeight:500}} onClick={()=>month&&loadHistory(month)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(month)loadHistory(month);}}}>{payload.value}</text>;}}
                    axisLine={false}
                    tickLine={false}
                    stroke="#95a4ae"
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    stroke="#95a4ae"
                    style={{ fontSize: '12px', fontWeight: '500' }}
                    width={48}
                    tickCount={4}
                    tickFormatter={value=>value>=1000?`$${Number((value/1000).toFixed(1))}k`:`$${value}`}
                  />
                  <Tooltip content={<CollectionTooltip/>} cursor={{fill:'var(--chart-top)',fillOpacity:0.045,radius:10}} />
                  <Bar
                    isAnimationActive={false}
                    maxBarSize={40}
                    dataKey="amount"
                    onClick={(_entry,index)=>monthlyData[index]&&loadHistory(monthlyData[index])}
                    cursor="pointer"
                    fill="url(#collection-fill)"
                    activeBar={{fill:'var(--chart-active)',stroke:'none'}}
                    stroke="none"
                    strokeWidth={0}
                    radius={[7, 7, 3, 3]}
                    name="Collected revenue"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <aside className="studio-side"><section className="studio-facts" aria-label="Collection performance"><h2>The recovery picture</h2><div><span>Recovered payments</span><strong>{getMainCurrencyCount()}</strong><small>Successful collections</small></div><div><span>Average payment</span><strong>{formatCurrency(getMainCurrencyCount()?getMainCurrencyTotal()/getMainCurrencyCount():0,selectedCurrency)}</strong><small>Per recovered payment</small></div><div><span>Latest collection</span><strong>{summary?.lastRecovery?formatLastRecoveryTime(summary.lastRecovery.date):'No collections yet'}</strong></div></section><a className="studio-next" href={preview?'/design-preview/queue':'/dashboard'}><span>Keep revenue moving</span><strong>Review failed payments <LuArrowUpRight/></strong><p>Find unpaid invoices and start a recovery run.</p></a></aside></div>
          <aside className="monthly-ledger studio-journal"><div className="analysis-heading"><div><h2>Recovery journal</h2><p>Open a month to see customers, amounts and payment details.</p></div></div><div className="ledger-columns"><span>Month / Payments</span><span>Collected</span></div><div className="history-months" role="group" aria-label="Choose a recovery month">{monthlyData.map(month=><button key={monthKey(month)} aria-pressed={selectedMonth&&monthKey(selectedMonth)===monthKey(month)} onClick={()=>loadHistory(month)}><span><strong>{month.month}</strong><small>{month.count} payments</small></span><span>{money(Math.round(month.amount*100),selectedCurrency)} <LuArrowUpRight/></span></button>)}</div><p className="ledger-footnote">Recorded collections only.<br/>All dates use New York time.</p></aside>
          {selectedMonth&&<section className="profile-section recovery-history" ref={historySection} aria-label="People charged this month" aria-busy={historyLoading}>
            <div className="workspace-heading"><div><h2>People charged — {selectedMonth.month}</h2><p>Successful collections recorded by this app, within your applied date filter.</p></div><button className="quick-filter-btn" onClick={()=>loadHistory(selectedMonth)} disabled={historyLoading}>Refresh this month</button></div>
            {history&&<p className="history-total">{history.totalCount} payments · {history.customerCount} customers · <strong>{money(history.totalAmount,history.currency)} {history.currency}</strong></p>}
            {historyLoading&&<p role="status">Loading payment history…</p>}
            {historyError&&<p role="alert" className="error-message">{historyError}</p>}
            {history&&!historyLoading&&!history.totalCount&&<p>No recorded collections match this month and date range.</p>}
            {history?.recoveries?.length>0&&<div className="table-container"><table className="transactions-table"><thead><tr><th>Customer</th><th>Collected (New York)</th><th>Amount</th><th>Card used</th><th>Invoice / run</th><th>Payment</th></tr></thead><tbody>{history.recoveries.map(row=><tr key={row._id}>
              <td>{row.customerId?<a href={`https://dashboard.stripe.com/customers/${row.customerId}`} target="_blank" rel="noreferrer">{row.customerEmail||row.customerId}</a>:(row.customerEmail||'Customer not recorded')}</td>
              <td>{collectedDate(row.recoveredAt)}</td><td className="amount">{money(row.amount,row.currency)} <small>{row.currency}</small></td>
              <td>{row.paymentMethodDetails?.last4?<>{row.paymentMethodDetails.brand||'Card'} •••• {row.paymentMethodDetails.last4}</>:'Not recorded'}</td>
              <td>{row.invoiceId?<><a href={`https://dashboard.stripe.com/invoices/${row.invoiceId}`} target="_blank" rel="noreferrer">{row.invoiceId}</a>{row.subscriptionId&&<p className="recovery-reason"><a href={`https://dashboard.stripe.com/subscriptions/${row.subscriptionId}`} target="_blank" rel="noreferrer">{row.subscriptionId}</a></p>}{row.retryBatchId&&<p className="recovery-reason">Run: {row.retryBatchId}</p>}</>:<span className="recovery-reason">Not recorded for this earlier payment</span>}</td>
              <td>{row.paymentIntentId?<a href={`https://dashboard.stripe.com/payments/${row.paymentIntentId}`} target="_blank" rel="noreferrer">View Stripe payment<span className="history-reference">{row.paymentIntentId}</span></a>:'Payment reference not recorded'}</td>
            </tr>)}</tbody></table></div>}
            {history?.hasMore&&<button className="quick-filter-btn history-more" onClick={()=>loadHistory(selectedMonth,history.nextCursor)} disabled={historyLoading}>Load more payments</button>}
            {history&&<p className="history-help">Showing {history.recoveries.length} of {history.totalCount} payments. Earlier records may lack invoice or card details; the Stripe payment remains the source for those details.</p>}
          </section>}
        </div>
      </div>
    </div>
  );
}

export default Home;
