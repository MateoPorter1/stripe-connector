const STRIPE_SECRET_KEY = process.env.REACT_APP_STRIPE_SECRET_KEY;

export const getFailedTransactions = async (limit = 100, startDate = null, endDate = null) => {
  try {
    let url = `https://api.stripe.com/v1/payment_intents?limit=${limit}`;

    // For testing, let's get all payment intents first and filter later
    // url += `&status=requires_payment_method`;

    // If no dates provided, use last 7 days by default for failed transactions
    if (!startDate && !endDate) {
      const sevenDaysAgo = Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000);
      url += `&created[gte]=${sevenDaysAgo}`;
    } else {
      // If start date is provided
      if (startDate) {
        const startTimestamp = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
        url += `&created[gte]=${startTimestamp}`;
        console.log('Start timestamp:', startTimestamp, 'for date:', startDate);
      }

      // If end date is provided
      if (endDate) {
        const endTimestamp = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);
        url += `&created[lte]=${endTimestamp}`;
        console.log('End timestamp:', endTimestamp, 'for date:', endDate);
      }
    }

    console.log('Fetching URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Stripe API Error:', response.status, errorData);
      throw new Error(`Error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
    }

    const data = await response.json();

    // Filter for failed transactions (requires_payment_method, failed, or canceled)
    const failedTransactions = (data.data || []).filter(transaction =>
      transaction.status === 'requires_payment_method' ||
      transaction.status === 'failed' ||
      transaction.status === 'canceled'
    );

    // Sort by most recent date first
    const sortedTransactions = failedTransactions.sort((a, b) => b.created - a.created);

    console.log('Found transactions:', data.data?.length, 'Failed:', sortedTransactions.length);

    return {
      success: true,
      transactions: sortedTransactions,
      total: sortedTransactions.length
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      success: false,
      error: error.message,
      transactions: []
    };
  }
};

// Function to get customer information
export const getCustomerInfo = async (customerId) => {
  if (!customerId) return null;

  try {
    const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) return null;

    const customer = await response.json();
    return customer;
  } catch (error) {
    console.error('Error fetching customer information:', error);
    return null;
  }
};

// Function to get customer's payment methods
export const getCustomerPaymentMethods = async (customerId) => {
  if (!customerId) return { count: 0, methods: [] };

  try {
    const response = await fetch(`https://api.stripe.com/v1/payment_methods?customer=${customerId}&type=card`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) return { count: 0, methods: [] };

    const data = await response.json();
    return {
      count: data.data?.length || 0,
      methods: data.data || []
    };
  } catch (error) {
    console.error('Error fetching customer payment methods:', error);
    return { count: 0, methods: [] };
  }
};

// Function to retry payment with a specific payment method
export const retryPaymentWithMethod = async (paymentIntentId, paymentMethodId) => {
  try {
    // First, attach the payment method to the payment intent
    const updateResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `payment_method=${paymentMethodId}`
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update payment intent: ${updateResponse.status}`);
    }

    // Then, confirm the payment intent
    const confirmResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!confirmResponse.ok) {
      throw new Error(`Failed to confirm payment: ${confirmResponse.status}`);
    }

    const result = await confirmResponse.json();
    return {
      success: result.status === 'succeeded',
      status: result.status,
      paymentMethodId: paymentMethodId,
      error: result.status !== 'succeeded' ? result.last_payment_error?.message : null
    };
  } catch (error) {
    console.error('Error retrying payment:', error);
    return {
      success: false,
      status: 'failed',
      paymentMethodId: paymentMethodId,
      error: error.message
    };
  }
};

// Function to retry payment across all customer's payment methods
export const retryCustomerPayment = async (paymentIntentId, customerId) => {
  try {
    // Get all customer's payment methods
    const { methods } = await getCustomerPaymentMethods(customerId);

    if (methods.length === 0) {
      return {
        success: false,
        message: 'No payment methods found for customer',
        attempts: []
      };
    }

    const attempts = [];

    // Try each payment method until one succeeds
    for (const method of methods) {
      const result = await retryPaymentWithMethod(paymentIntentId, method.id);
      attempts.push({
        paymentMethodId: method.id,
        brand: method.card?.brand,
        last4: method.card?.last4,
        result: result
      });

      // If this payment method succeeded, stop trying others
      if (result.success) {
        return {
          success: true,
          message: `Payment successful with ${method.card?.brand} ending in ${method.card?.last4}`,
          attempts: attempts,
          successfulMethod: method
        };
      }
    }

    // If we get here, all payment methods failed
    return {
      success: false,
      message: `All ${methods.length} payment methods failed`,
      attempts: attempts
    };
  } catch (error) {
    console.error('Error in retry customer payment:', error);
    return {
      success: false,
      message: error.message,
      attempts: []
    };
  }
};

// Function to calculate months paid based on amount
export const calculateMonthsPaid = (amount, currency = 'usd') => {
  // These are estimates - you should adjust according to your actual prices
  const monthlyPrices = {
    'usd': 2999, // $29.99 in cents
    'eur': 2999, // €29.99 in cents
    'mxn': 59900, // $599 MXN in cents
  };

  const monthlyPrice = monthlyPrices[currency.toLowerCase()] || monthlyPrices.usd;
  return Math.round(amount / monthlyPrice) || 1;
};

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

// Function to get country flag emoji from country code
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