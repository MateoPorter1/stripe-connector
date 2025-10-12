import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  getFailedTransactions,
  getCustomerInfo,
  getCustomerPaymentMethods,
  retryCustomerPayment,
  formatCurrency,
  formatDate,
  getCountryFlag
} from '../services/api';
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

  const handleGetFailedTransactions = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getFailedTransactions(100, startDate, endDate);

      if (result.success) {
        setHasLoaded(true);
        setTotalFetched(result.totalFetched || result.transactions.length);

        if (result.transactions.length === 0) {
          setError(`No failed transactions found between ${startDate} and ${endDate}.`);
        } else {
          // Enrich transactions with customer data
          await enrichFailedTransactionsWithCustomerData(result.transactions);
        }
      } else {
        setError(result.error || 'Error fetching failed transactions');
      }
    } catch (err) {
      setError('Connection error. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const enrichFailedTransactionsWithCustomerData = async (rawTransactions) => {
    const enriched = [];

    for (const transaction of rawTransactions) {
      let customerInfo = null;
      let paymentMethods = { count: 0, methods: [] };

      if (transaction.customer) {
        customerInfo = await getCustomerInfo(transaction.customer);
        paymentMethods = await getCustomerPaymentMethods(transaction.customer);
      }

      const enrichedTransaction = {
        id: transaction.id,
        customer: transaction.customer,
        email: customerInfo?.email || 'No email',
        amount: formatCurrency(transaction.amount, transaction.currency),
        country: customerInfo?.address?.country ||
                 transaction.charges?.data?.[0]?.billing_details?.address?.country ||
                 'Unknown',
        countryFlag: getCountryFlag(
          customerInfo?.address?.country ||
          transaction.charges?.data?.[0]?.billing_details?.address?.country
        ),
        paymentMethodsCount: paymentMethods.count,
        date: formatDate(transaction.created),
        rawAmount: transaction.amount,
        currency: transaction.currency
      };

      enriched.push(enrichedTransaction);
    }

    setFailedTransactions(enriched);
  };

  const handleRetryPayment = async (transaction) => {
    if (!transaction.customer) {
      alert('Cannot retry payment: No customer associated with this transaction');
      return;
    }

    setRetryingPayments(prev => new Set([...prev, transaction.id]));

    try {
      const result = await retryCustomerPayment(transaction.id, transaction.customer);

      if (result.success) {
        alert(`✅ Payment successful! ${result.message}`);
        // Remove this transaction from the failed list since it's now successful
        setFailedTransactions(prev => prev.filter(t => t.id !== transaction.id));
      } else {
        alert(`❌ Payment failed: ${result.message}\n\nAttempts made: ${result.attempts.length}`);
      }
    } catch (error) {
      alert(`❌ Error retrying payment: ${error.message}`);
    } finally {
      setRetryingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(transaction.id);
        return newSet;
      });
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content">
        <div className="container">
        <div className="header">
          <div>
            <h1>❌ Failed Stripe Transactions</h1>
            <p>Manage and retry failed payments with smart recovery</p>
          </div>
        </div>

        <div className="filter-section">
          <div className="date-filters">
            <div className="date-input-group">
              <label htmlFor="startDate">From Date:</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
                className="date-input"
              />
            </div>

            <button
              onClick={handleGetFailedTransactions}
              disabled={loading || !startDate || !endDate}
              className="search-button"
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Loading...
                </>
              ) : (
                <>
                  🔍 Load Failed Transactions
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {hasLoaded && failedTransactions.length > 0 && (
          <div className="results-section">
            <div className="results-header">
              <h2>❌ {failedTransactions.length} Failed Transactions</h2>
              {totalFetched > 0 && (
                <p className="results-info">
                  Encontradas {failedTransactions.length} transacciones fallidas de un total de {totalFetched} transacciones revisadas
                  ({((failedTransactions.length / totalFetched) * 100).toFixed(1)}% fallidas)
                </p>
              )}
            </div>

            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Amount</th>
                    <th>Country</th>
                    <th>Payment Methods</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {failedTransactions.map((transaction, index) => (
                    <tr key={transaction.id} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td className="email-cell">
                        <div className="email-info">
                          <span className="email">{transaction.email}</span>
                          <span className="transaction-id">#{transaction.id.slice(-8)}</span>
                        </div>
                      </td>
                      <td className="valor-cell">
                        <span className="amount">{transaction.amount}</span>
                      </td>
                      <td className="country-cell">
                        <div className="country-info">
                          <span className="flag">{transaction.countryFlag}</span>
                          <span className="country-name">{transaction.country}</span>
                        </div>
                      </td>
                      <td className="payment-methods-cell">
                        <span className="payment-count">
                          {transaction.paymentMethodsCount} method{transaction.paymentMethodsCount !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="fecha-cell">
                        <span className="date">{transaction.date}</span>
                      </td>
                      <td className="actions-cell">
                        <button
                          onClick={() => handleRetryPayment(transaction)}
                          disabled={retryingPayments.has(transaction.id) || transaction.paymentMethodsCount === 0}
                          className="retry-button"
                        >
                          {retryingPayments.has(transaction.id) ? (
                            <>
                              <div className="spinner-small"></div>
                              Retrying...
                            </>
                          ) : (
                            <>
                              🔄 Retry Payment
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

        {hasLoaded && failedTransactions.length === 0 && !error && (
          <div className="empty-state">
            <h3>🎉 No failed transactions</h3>
            <p>No failed transactions found for the selected date range.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
