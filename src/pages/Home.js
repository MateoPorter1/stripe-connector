import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { LuHouse, LuCalendar, LuDollarSign, LuRefreshCw, LuTrendingUp, LuClock, LuChartBarBig, LuInbox } from 'react-icons/lu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './Home.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Home() {
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCurrency] = useState('USD');

  const fetchData = React.useCallback(async (start = null, end = null) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Construir query params
      let summaryUrl = `${API_URL}/stats/summary`;
      let monthlyUrl = `${API_URL}/stats/by-month?currency=${selectedCurrency}`;

      if (start) {
        summaryUrl += `?startDate=${start}`;
        monthlyUrl += `&startDate=${start}`;
      }
      if (end) {
        summaryUrl += start ? `&endDate=${end}` : `?endDate=${end}`;
        monthlyUrl += `&endDate=${end}`;
      }

      // Fetch summary
      const summaryResponse = await fetch(summaryUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Fetch monthly data
      const monthlyResponse = await fetch(monthlyUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.summary);
      }

      if (monthlyResponse.ok) {
        const monthlyDataResult = await monthlyResponse.json();
        setMonthlyData(monthlyDataResult.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCurrency]);

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApplyFilter = () => {
    fetchData(startDate, endDate);
  };

  const handleQuickFilter = (type) => {
    const today = new Date();
    let start, end;

    switch (type) {
      case 'this-month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      case 'last-3-months':
        start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        end = today;
        break;
      case 'this-year':
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
        break;
      case 'all-time':
        start = null;
        end = null;
        setStartDate('');
        setEndDate('');
        fetchData(null, null);
        return;
      default:
        return;
    }

    if (start) setStartDate(start.toISOString().split('T')[0]);
    if (end) setEndDate(end.toISOString().split('T')[0]);
    fetchData(start?.toISOString().split('T')[0], end?.toISOString().split('T')[0]);
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
                <label>From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="date-input-group">
                <label>To:</label>
                <input
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
        </div>
      </div>
    </div>
  );
}

export default Home;
