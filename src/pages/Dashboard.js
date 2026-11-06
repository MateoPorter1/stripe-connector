import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import RecoveryBanner from '../components/RecoveryBanner';
import { LuCircleX, LuSearch, LuTriangleAlert, LuUsers, LuRefreshCw } from 'react-icons/lu';
import {
  getFailedTransactions,
  getCustomerPaymentMethods,
  retryCustomerPayment,
  formatCurrency,
  formatDate,
  getCountryFlag
} from '../services/api';
import { mergePaymentPages, queueKey } from '../services/recoveryQueue';
import './Dashboard.css';

function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [failedTransactions, setFailedTransactions] = useState([]);
  const [totalFetched, setTotalFetched] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [retryingPayments, setRetryingPayments] = useState(new Set());
  const [checkingCards, setCheckingCards] = useState(new Set());
  const [nextCursor, setNextCursor] = useState(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanRange, setScanRange] = useState(null);
  const scanController = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; scanController.current?.abort(); };
  }, []);

  // Function to get default start date (7 days ago for failed transactions)
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  // Function to get today's date
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Initialize default dates
  React.useEffect(() => {
    setStartDate(getDefaultStartDate());
    setEndDate(getTodayDate());
  }, []);

  const handleGetFailedTransactions = async (resume = false) => {
    scanController.current?.abort();
    const controller = new AbortController();
    scanController.current = controller;
    const range = resume ? scanRange : { startDate, endDate };
    if (!range || range.startDate > range.endDate) {
      setError('The start date must come before the end date.');
      return;
    }
    setLoading(true);
    setError('');
    setScanComplete(false);
    if (!resume) {
      setFailedTransactions([]);
      setTotalFetched(0);
      setHasLoaded(false);
      setNextCursor(null);
      setScanRange(range);
    }
    let cursor = resume ? nextCursor : null;
    try {
      do {
        const result = await getFailedTransactions(100, range.startDate, range.endDate, cursor, controller.signal);
        if (controller.signal.aborted || !mounted.current) return;
        if (!result.success) throw new Error(result.error || 'Could not load payments.');
        if (result.hasMore && (!result.nextCursor || result.nextCursor === cursor)) {
          throw new Error('The scan could not advance. Please reload the queue.');
        }
        setHasLoaded(true);
        setFailedTransactions(previous => mergePaymentPages(previous, result.customers));
        setTotalFetched(previous => previous + (result.totalFetched || 0));
        cursor = result.nextCursor || null;
        setNextCursor(cursor);
      } while (cursor);
      setScanComplete(true);
    } catch (err) {
      if (!controller.signal.aborted && mounted.current) setError(err.message);
    } finally {
      if (scanController.current === controller && mounted.current) setLoading(false);
    }
  };

  const handleCheckCards = async customer => {
    setCheckingCards(previous => new Set([...previous, customer.customer]));
    try {
      const result = await getCustomerPaymentMethods(customer.customer);
      if (!mounted.current) return;
      if (!result.success) throw new Error('Could not check saved cards. Please try again.');
      setFailedTransactions(previous => previous.map(row => row.customer === customer.customer ? { ...row, paymentMethodsCount: result.count } : row));
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setCheckingCards(previous => {
        const next = new Set(previous); next.delete(customer.customer); return next;
      });
    }
  };

  const handleRetryPayment = async (customer) => {
    if (!customer.customer) {
      alert('Cannot retry payment: No customer ID');
      return;
    }

    // Usar el primer payment intent como referencia para el retry
    const firstTransaction = customer.transactions[0];

    setRetryingPayments(prev => new Set([...prev, customer.customer]));

    try {
      const result = await retryCustomerPayment(firstTransaction.id, customer.customer);

      if (result.success) {
        alert(`Payment successful. Recovered ${formatCurrency(firstTransaction.amount, customer.currency)} for ${customer.email}.`);
        setFailedTransactions(previous => previous.flatMap(row => {
          if (queueKey(row) !== queueKey(customer)) return [row];
          const transactions = row.transactions.filter(payment => payment.id !== firstTransaction.id);
          return transactions.length ? [{ ...row, transactions, failedCount: transactions.length,
            totalAmount: transactions.reduce((sum, payment) => sum + payment.amount, 0),
            latestDate: Math.max(...transactions.map(payment => payment.created)) }] : [];
        }));
      } else {
        alert(`❌ Payment failed: ${result.message}\n\nAttempts made: ${result.attempts.length}`);
      }
    } catch (error) {
      alert(`❌ Error retrying payment: ${error.message}`);
    } finally {
      setRetryingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(customer.customer);
        return newSet;
      });
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content">
        <div className="container">
        <RecoveryBanner title="Good revenue deserves a comeback." subtitle="Find failed payments. Review your customers. Bring revenue back into the fold." />
        <div className="workspace-heading"><div><h1>Recovery queue</h1><p>Failed payments, grouped by customer.</p></div><span className="workspace-tag">Stripe workspace</span></div>

        <div className="filter-section">
          <div className="date-filters">
            <div className="date-input-group">
              <label htmlFor="startDate">From Date:</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                className="date-input"
              />
            </div>

            <div className="date-input-group">
              <label htmlFor="endDate">To Date:</label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                className="date-input"
              />
            </div>

            <button
              onClick={() => handleGetFailedTransactions(false)}
              disabled={loading || !startDate || !endDate}
              className="search-button"
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Scanning…
                </>
              ) : (
                <>
                  <LuSearch /> Load Failed Transactions
                </>
              )}
            </button>
            {loading && <button className="quick-filter-btn" onClick={() => { scanController.current?.abort(); setLoading(false); }}>Pause scan</button>}
            {!loading && nextCursor && scanRange?.startDate === startDate && scanRange?.endDate === endDate && <button className="quick-filter-btn" onClick={() => handleGetFailedTransactions(true)}>Continue scan</button>}
          </div>
          <p className="scan-note">Customers appear as payments are checked. Saved cards are checked separately when you need them.</p>
        </div>

        {(loading || hasLoaded) && <p className="scan-progress" role="status" aria-live="polite">
          {loading ? 'Scanning Stripe — results are updating.' : scanComplete ? 'Scan complete.' : 'Scan incomplete — results below cover only the payments checked so far.'}
          {' '}{totalFetched.toLocaleString()} payments checked.
        </p>}
        {error && (
          <div className="error-message" role="alert">
            <LuTriangleAlert style={{ display: 'inline', marginRight: '8px' }} /> {error}
          </div>
        )}

        {(
          <div className="results-section">
            <div className="results-header">
              <h2><LuUsers /> {hasLoaded ? `${new Set(failedTransactions.map(customer => customer.customer)).size} customers` : 'Your customers'}</h2>
              {totalFetched > 0 && (
                <p className="results-info">
                  {new Set(failedTransactions.map(customer => customer.customer)).size} customers · {failedTransactions.length} rows, separated by currency · {totalFetched.toLocaleString()} payments reviewed
                </p>
              )}
            </div>

            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Total Amount</th>
                    <th>Failed Count</th>
                    <th>Country</th>
                    <th>Payment Methods</th>
                    <th>Latest Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {failedTransactions.length === 0 && <tr><td colSpan="7"><div className="queue-empty"><LuCircleX size={32}/><h3>{loading ? 'Finding failed payments…' : scanComplete ? 'No customers in this queue' : hasLoaded ? 'No failed payments found so far'  : 'Your next recovery starts here.'}</h3><p>{scanComplete ? 'Choose another date range to review more payments.' : loading ? 'Results will appear here as each batch arrives.' : 'Choose a date range and load failed payments to see your recovery queue.'}</p></div></td></tr>}

                  {failedTransactions.map((customer, index) => (
                    <tr key={queueKey(customer)} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td className="email-cell">
                        <div className="email-info">
                          <span className="email">{customer.email}</span>
                          <span className="transaction-id">#{customer.customer.slice(-8)}</span>
                        </div>
                      </td>
                      <td className="valor-cell">
                        <span className="amount">{formatCurrency(customer.totalAmount, customer.currency)}</span>
                      </td>
                      <td className="failed-count-cell">
                        <span className="failed-count">{customer.failedCount} failed</span>
                      </td>
                      <td className="country-cell">
                        <div className="country-info">
                          <span className="flag">{getCountryFlag(customer.country)}</span>
                          <span className="country-name">{customer.country}</span>
                        </div>
                      </td>
                      <td className="payment-methods-cell">
                        {customer.paymentMethodsCount === null ? <button className="quick-filter-btn" onClick={() => handleCheckCards(customer)} disabled={checkingCards.has(customer.customer)}>
                          {checkingCards.has(customer.customer) ? 'Checking…' : 'Check cards'}
                        </button> : <span className="payment-count">{customer.paymentMethodsCount} saved card{customer.paymentMethodsCount !== 1 ? 's' : ''}</span>}
                      </td>
                      <td className="fecha-cell">
                        <span className="date">{formatDate(customer.latestDate)}</span>
                      </td>
                      <td className="actions-cell">
                        <button
                          onClick={() => handleRetryPayment(customer)}
                          disabled={loading || !scanComplete || retryingPayments.has(customer.customer) || !customer.paymentMethodsCount}
                          title={!scanComplete ? 'Finish the scan before retrying a payment.' : customer.paymentMethodsCount === null ? 'Check saved cards first.' : customer.paymentMethodsCount === 0 ? 'This customer has no saved cards.' : 'Retry the latest failed payment.'}
                          className="retry-button"
                        >
                          {retryingPayments.has(customer.customer) ? (
                            <>
                              <div className="spinner-small"></div>
                              Retrying...
                            </>
                          ) : (
                            <>
                              <LuRefreshCw /> Retry Payment
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        </div>
      </div>
    </div>
  );
}

export default Dashboard;
