// Servicio para llamar al backend en lugar de Stripe directamente
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export const getFailedTransactions = async (limit = 100, startDate = null, endDate = null) => {
  try {
    let url = `${API_URL}/stripe/failed-transactions?limit=${limit}`;

    if (startDate) {
      url += `&startDate=${startDate}`;
    }
    if (endDate) {
      url += `&endDate=${endDate}`;
    }

    const response = await fetch(url, {
      headers: getAuthHeader()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error fetching transactions');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      success: false,
      error: error.message,
      transactions: []
    };
  }
};

export const getCustomerInfo = async (customerId) => {
  if (!customerId) return null;

  try {
    const response = await fetch(`${API_URL}/stripe/customer/${customerId}`, {
      headers: getAuthHeader()
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.customer;
  } catch (error) {
    console.error('Error fetching customer information:', error);
    return null;
  }
};

export const getCustomerPaymentMethods = async (customerId) => {
  if (!customerId) return { count: 0, methods: [] };

  try {
    const response = await fetch(`${API_URL}/stripe/payment-methods/${customerId}`, {
      headers: getAuthHeader()
    });

    if (!response.ok) return { count: 0, methods: [] };

    const data = await response.json();
    return {
      count: data.count,
      methods: data.methods
    };
  } catch (error) {
    console.error('Error fetching customer payment methods:', error);
    return { count: 0, methods: [] };
  }
};

export const retryCustomerPayment = async (paymentIntentId, customerId) => {
  try {
    const response = await fetch(`${API_URL}/stripe/retry-payment`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ paymentIntentId, customerId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error retrying payment');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in retry customer payment:', error);
    return {
      success: false,
      message: error.message,
      attempts: []
    };
  }
};

// Utility functions (no cambian)
export const formatCurrency = (amount, currency = 'usd') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

export const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getCountryFlag = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '🏳️';

  const countryFlags = {
    'US': '🇺🇸', 'CA': '🇨🇦', 'MX': '🇲🇽', 'GB': '🇬🇧', 'DE': '🇩🇪',
    'FR': '🇫🇷', 'ES': '🇪🇸', 'IT': '🇮🇹', 'BR': '🇧🇷', 'AR': '🇦🇷',
    'AU': '🇦🇺', 'JP': '🇯🇵', 'CN': '🇨🇳', 'IN': '🇮🇳', 'RU': '🇷🇺',
    'KR': '🇰🇷', 'SG': '🇸🇬', 'HK': '🇭🇰', 'NL': '🇳🇱', 'SE': '🇸🇪',
    'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱', 'CZ': '🇨🇿',
    'AT': '🇦🇹', 'CH': '🇨🇭', 'BE': '🇧🇪', 'IE': '🇮🇪', 'PT': '🇵🇹',
    'GR': '🇬🇷', 'TR': '🇹🇷', 'IL': '🇮🇱', 'SA': '🇸🇦', 'AE': '🇦🇪',
    'ZA': '🇿🇦', 'EG': '🇪🇬', 'NG': '🇳🇬', 'KE': '🇰🇪', 'GH': '🇬🇭',
    'TH': '🇹🇭', 'VN': '🇻🇳', 'PH': '🇵🇭', 'ID': '🇮🇩', 'MY': '🇲🇾',
    'NZ': '🇳🇿', 'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪', 'VE': '🇻🇪'
  };

  return countryFlags[countryCode.toUpperCase()] || '🏳️';
};
