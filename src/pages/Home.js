import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { LuHouse, LuCalendar, LuDollarSign, LuRefreshCw, LuTrendingUp, LuClock, LuChartBarBig, LuInbox } from 'react-icons/lu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {statsRequest} from '../services/api';
import './Home.css';

const monthKey=row=>`${row.year}-${String(row.monthNumber).padStart(2,'0')}`;
const money=(cents,currency)=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(cents/100);
const collectedDate=date=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(date));

function Home() {
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
      const [totals,monthly]=await Promise.all([statsRequest(`/summary?${params}`,{signal:controller.signal}),statsRequest(`/by-month?${monthlyParams}`,{signal:controller.signal})]);
      if(controller.signal.aborted)return;
      setSummary(totals.summary);setMonthlyData(monthly.data||[]);setAppliedRange({start,end});
    }catch(err){if(!controller.signal.aborted){setError(err.message);setSummary(null);setMonthlyData([]);}}
    finally{if(!controller.signal.aborted)setLoading(false);}
  },[selectedCurrency]);
  useEffect(()=>{fetchData();return()=>{dataController.current?.abort();historyController.current?.abort();};},[fetchData]);
  useEffect(()=>{if(selectedMonth)historySection.current?.scrollIntoView?.({behavior:'smooth',block:'start'});},[selectedMonth]);

  const loadHistory=async(month,cursor=null)=>{
    historyController.current?.abort();const controller=new AbortController();historyController.current=controller;
    const key=monthKey(month);setSelectedMonth(month);setHistoryLoading(true);setHistoryError('');if(!cursor)setHistory(null);
    const params=new URLSearchParams({month:key,currency:selectedCurrency});
    if(appliedRange.start)params.set('startDate',appliedRange.start);if(appliedRange.end)params.set('endDate',appliedRange.end);if(cursor)params.set('cursor',cursor);
    try{
      const data=await statsRequest(`/recoveries?${params}`,{signal:controller.signal});
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
        <Sidebar />
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
      <Sidebar />
      <div className="home-content">
        <div className="home-container">
          {/* Header */}
          <div className="home-header">
            <div>
              <h1><LuHouse style={{ display: 'inline', marginRight: '8px' }} /> Recovery Dashboard</h1>
              <p>Monitor how much you've recovered with Stripe Connector</p>
            </div>
          </div>

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

          {error&&<p className="error-message" role="alert">{error}</p>}
          {/* Scorecards */}
          <div className="scorecards-grid">
            <div className="scorecard scorecard-primary">
              <div className="scorecard-icon"><LuDollarSign size={28} /></div>
              <div className="scorecard-content">
                <div className="scorecard-value">
                  {formatCurrency(getMainCurrencyTotal(), selectedCurrency)}
                </div>
                <div className="scorecard-label">Total Recovered</div>
              </div>
            </div>

            <div className="scorecard scorecard-success">
              <div className="scorecard-icon"><LuRefreshCw size={28} /></div>
              <div className="scorecard-content">
                <div className="scorecard-value">{getMainCurrencyCount()}</div>
                <div className="scorecard-label">Recovered Payments</div>
              </div>
            </div>

            <div className="scorecard scorecard-info">
              <div className="scorecard-icon"><LuTrendingUp size={28} /></div>
              <div className="scorecard-content">
                <div className="scorecard-value">
                  {getMainCurrencyCount() > 0
                    ? formatCurrency(getMainCurrencyTotal() / getMainCurrencyCount(), selectedCurrency)
                    : formatCurrency(0, selectedCurrency)}
                </div>
                <div className="scorecard-label">Average per Payment</div>
              </div>
            </div>

            <div className="scorecard scorecard-warning">
              <div className="scorecard-icon"><LuClock size={28} /></div>
              <div className="scorecard-content">
                <div className="scorecard-value">
                  {summary?.lastRecovery
                    ? formatLastRecoveryTime(summary.lastRecovery.date)
                    : 'N/A'}
                </div>
                <div className="scorecard-label">Last Payment</div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="chart-section">
            <h2 className="chart-title"><LuChartBarBig style={{ display: 'inline', marginRight: '8px' }} /> Monthly Recovery</h2>

            <p className="history-help">Click a bar or a month below to see every recorded payment. Dates use New York time.</p>
            {monthlyData.length === 0 ? (
              <div className="empty-chart-state">
                <p className="empty-icon"><LuInbox size={64} /></p>
                <h3>No data to display</h3>
                <p>Recover your first payment to see statistics here</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8fdf0" />
                  <XAxis
                    dataKey="month"
                    tick={({x,y,payload})=>{const month=monthlyData.find(item=>item.month===payload.value);return <text x={x} y={y} dy={18} textAnchor="middle" fill="#1a5a3e" role="button" tabIndex={0} aria-label={`View payments for ${payload.value}`} style={{cursor:'pointer',fontSize:14,fontWeight:600}} onClick={()=>month&&loadHistory(month)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(month)loadHistory(month);}}}>{payload.value}</text>;}}
                    stroke="#1a5a3e"
                    style={{ fontSize: '14px', fontWeight: '600' }}
                  />
                  <YAxis
                    stroke="#1a5a3e"
                    style={{ fontSize: '14px', fontWeight: '600' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '3px solid #1a5a3e',
                      borderRadius: '15px',
                      fontWeight: '600'
                    }}
                    formatter={(value) => [`$${value}`, 'Recovered']}
                  />
                  <Legend
                    wrapperStyle={{ fontWeight: '700', fontSize: '14px' }}
                  />
                  <Bar
                    dataKey="amount"
                    onClick={(_entry,index)=>monthlyData[index]&&loadHistory(monthlyData[index])}
                    cursor="pointer"
                    fill="#ffe066"
                    stroke="#1a5a3e"
                    strokeWidth={2}
                    radius={[10, 10, 0, 0]}
                    name="Recovered Amount"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {monthlyData.length>0&&<div className="history-months" role="group" aria-label="Choose a recovery month">{monthlyData.map(month=><button key={monthKey(month)} className="quick-filter-btn" aria-pressed={selectedMonth&&monthKey(selectedMonth)===monthKey(month)} onClick={()=>loadHistory(month)}><strong>{month.month}</strong><span>{month.count} payments · {money(Math.round(month.amount*100),selectedCurrency)}</span></button>)}</div>}
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
