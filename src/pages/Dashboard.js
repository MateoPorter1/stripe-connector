import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  getFailedTransactions,
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
        setTotalFetched(result.totalFetched || 0);

        if (result.customers.length === 0) {
          setError(`No failed transactions found between ${startDate} and ${endDate}.`);
        } else {
          // Backend now returns fully enriched data - just format it for display
          const formattedCustomers = result.customers.map(customerData => ({
            customer: customerData.customer,
            email: customerData.email,
            totalAmount: formatCurrency(customerData.totalAmount, customerData.currency),
            failedCount: customerData.failedCount,
            country: customerData.country,
            countryFlag: getCountryFlag(customerData.country),
            paymentMethodsCount: customerData.paymentMethodsCount,
            date: formatDate(customerData.latestDate),
            rawAmount: customerData.totalAmount,
            currency: customerData.currency,
            transactions: customerData.transactions
          }));

          setFailedTransactions(formattedCustomers);
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
        alert(`✅ Payment successful! ${result.message}\n\nRecovered ${customer.failedCount} failed transaction(s) for ${customer.email}`);
        // Remove this customer from the failed list since payment is now successful
        setFailedTransactions(prev => prev.filter(c => c.customer !== customer.customer));
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
              <h2>👥 {failedTransactions.length} Customers with Failed Transactions</h2>
              {totalFetched > 0 && (
                <p className="results-info">
                  {failedTransactions.length} clientes únicos con transacciones fallidas de un total de {totalFetched} transacciones revisadas
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
                  {failedTransactions.map((customer, index) => (
                    <tr key={customer.customer} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td className="email-cell">
                        <div className="email-info">
                          <span className="email">{customer.email}</span>
                          <span className="transaction-id">#{customer.customer.slice(-8)}</span>
                        </div>
                      </td>
                      <td className="valor-cell">
                        <span className="amount">{customer.totalAmount}</span>
                      </td>
                      <td className="failed-count-cell">
                        <span className="failed-count">{customer.failedCount} failed</span>
                      </td>
                      <td className="country-cell">
                        <div className="country-info">
                          <span className="flag">{customer.countryFlag}</span>
                          <span className="country-name">{customer.country}</span>
                        </div>
                      </td>
                      <td className="payment-methods-cell">
                        <span className="payment-count">
                          {customer.paymentMethodsCount} method{customer.paymentMethodsCount !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="fecha-cell">
                        <span className="date">{customer.date}</span>
                      </td>
                      <td className="actions-cell">
                        <button
                          onClick={() => handleRetryPayment(customer)}
                          disabled={retryingPayments.has(customer.customer) || customer.paymentMethodsCount === 0}
                          className="retry-button"
                        >
                          {retryingPayments.has(customer.customer) ? (
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
