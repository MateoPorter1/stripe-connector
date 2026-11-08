import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { LuCalendar, LuArrowUpRight, LuInbox } from 'react-icons/lu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {statsRequest} from '../services/api';
import {studioDemoRequest} from './studioDemo';
import './Home.css';

const monthKey=row=>`${row.year}-${String(row.monthNumber).padStart(2,'0')}`;
const money=(cents,currency)=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(cents/100);
const collectedDate=date=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(date));

function Home({preview=false}) {
  const request=preview?studioDemoRequest:statsRequest;
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

  const handleApplyFilter = () => {
    fetchData(startDate, endDate);
  };

  const handleQuickFilter = (type) => {
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const date=new Date(`${today}T12:00:00Z`);let start=null,end=today;
    switch(type){
      case 'this-month':start=today.slice(0,7)+'-01';break;
      case 'last-3-months':start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-3,1,12)).toISOString().slice(0,10);break;
      case 'this-year':start=today.slice(0,4)+'-01-01';break;
      case 'all-time':end=null;break;
      default:return;
    }
    setStartDate(start||'');setEndDate(end||'');fetchData(start,end);
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
      <div className="home-layout">
        {preview?<aside className="sidebar studio-preview-sidebar"><div className="sidebar-header"><h2 className="sidebar-title"><span className="brand-symbol">r.</span><span className="brand-name">Revenue recovery</span></h2><p className="preview-note">Design preview<br/>Fictional demo data</p></div><nav className="sidebar-nav"><span className="nav-item active">Overview</span><a className="nav-item" href="https://stripe-connector-psi.vercel.app/dashboard">Recovery queue ↗</a></nav></aside>:<Sidebar />}
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
    <div className="home-layout">
      {preview?<aside className="sidebar studio-preview-sidebar"><div className="sidebar-header"><h2 className="sidebar-title"><span className="brand-symbol">r.</span><span className="brand-name">Revenue recovery</span></h2><p className="preview-note">Design preview<br/>Fictional demo data</p></div><nav className="sidebar-nav"><span className="nav-item active">Overview</span><a className="nav-item" href="https://stripe-connector-psi.vercel.app/dashboard">Recovery queue ↗</a></nav></aside>:<Sidebar />}
      <div className="home-content">
        <div className="home-container overview-workspace studio-workspace">
          <header className="overview-masthead"><div><span className="workspace-location">{preview?'Design preview / Demo data':'Revenue recovery'}</span><h1>Recovery overview</h1></div><a className="open-queue" href={preview?'https://stripe-connector-psi.vercel.app/dashboard':'/dashboard'}>Open recovery queue <LuArrowUpRight/></a></header>
          <div className="overview-filterbar">
          {/* Quick Filters */}
          <div className="quick-filters">
            <button onClick={() => handleQuickFilter('this-month')} className="quick-filter-btn">
              This Month
            </button>
            <button onClick={() => handleQuickFilter('last-3-months')} className="quick-filter-btn">
              Last 3 Months
            </button>
            <button onClick={() => handleQuickFilter('this-year')} className="quick-filter-btn">
              This Year
            </button>
            <button onClick={() => handleQuickFilter('all-time')} className="quick-filter-btn">
              All Time
            </button>
          </div>

          {/* Date Filter */}
          <div className="date-filter-section">
            <div className="date-inputs">
              <div className="date-input-group">
                <label htmlFor="recoveryFrom">From:</label>
                <input
                  id="recoveryFrom"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="date-input-group">
                <label htmlFor="recoveryThrough">To:</label>
                <input
                  id="recoveryThrough"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <button onClick={handleApplyFilter} className="apply-filter-btn">
                <LuCalendar /> Apply Filter
              </button>
            </div>
          </div>

          </div>
          {error&&<p className="error-message" role="alert">{error}</p>}
          <div className="overview-analysis">
          {/* Chart Section */}
          <div className="chart-section studio-performance">
            <div className="studio-performance-total"><span>Revenue recovered</span><strong>{formatCurrency(getMainCurrencyTotal(), selectedCurrency)}</strong><p>Collected through this workspace</p></div>
            <div className="analysis-heading"><div><h2>Monthly collections</h2></div><span>USD</span></div>

            
            {monthlyData.length === 0 ? (
              <div className="empty-chart-state">
                <p className="empty-icon"><LuInbox size={64} /></p>
                <h3>No data to display</h3>
                <p>Recover your first payment to see statistics here</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <defs><pattern id="collection-stripes" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="#f5a67d"/><path d="M0 6L6 0" stroke="#ffc5a5" strokeWidth="1"/></pattern></defs>
                  <CartesianGrid vertical={false} stroke="#354249" strokeDasharray="3 6" />
                  <XAxis
                    dataKey="month"
                    tick={({x,y,payload})=>{const month=monthlyData.find(item=>item.month===payload.value);return <text x={x} y={y} dy={18} textAnchor="middle" fill="#b6c2c8" role="button" tabIndex={0} aria-label={`View payments for ${payload.value}`} style={{cursor:'pointer',fontSize:12,fontWeight:500}} onClick={()=>month&&loadHistory(month)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(month)loadHistory(month);}}}>{payload.value}</text>;}}
                    stroke="#8d9ca4"
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <YAxis
                    stroke="#8d9ca4"
                    style={{ fontSize: '12px', fontWeight: '500' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e3e7e9',
                      borderRadius: '8px',
                      fontWeight: '500'
                    }}
                    formatter={(value) => [`$${value}`, 'Recovered']}
                  />
                  <Bar
                    isAnimationActive={false}
                    maxBarSize={48}
                    dataKey="amount"
                    onClick={(_entry,index)=>monthlyData[index]&&loadHistory(monthlyData[index])}
                    cursor="pointer"
                    fill="url(#collection-stripes)"
                    stroke="none"
                    strokeWidth={0}
                    radius={[4, 4, 0, 0]}
                    name="Collected revenue"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <aside className="studio-side"><section className="studio-facts" aria-label="Collection performance"><h2>The recovery picture</h2><div><span>Recovered payments</span><strong>{getMainCurrencyCount()}</strong><small>Successful collections</small></div><div><span>Average payment</span><strong>{formatCurrency(getMainCurrencyCount()?getMainCurrencyTotal()/getMainCurrencyCount():0,selectedCurrency)}</strong><small>Per recovered payment</small></div><div><span>Latest collection</span><strong>{summary?.lastRecovery?formatLastRecoveryTime(summary.lastRecovery.date):'No collections yet'}</strong></div></section><a className="studio-next" href={preview?'https://stripe-connector-psi.vercel.app/dashboard':'/dashboard'}><span>Keep revenue moving</span><strong>Review failed payments <LuArrowUpRight/></strong><p>Find unpaid invoices and start a recovery run.</p></a></aside></div>
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
