// Servicio para llamar al backend en lugar de Stripe directamente
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').trim().replace(/\/$/, '');

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export const getFailedTransactions = async (limit = 100, startDate = null, endDate = null, cursor = null, signal) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (cursor) params.set('cursor', cursor);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 30000);
  try {
    const response = await fetch(`${API_URL}/stripe/failed-transactions?${params}`, {
      headers: getAuthHeader(), signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load payments. Please try again.');
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    return { success: false, error: controller.signal.aborted ? 'Stripe took too long to respond. Please try again.' : error.message };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
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
  if (!customerId) return { success: false, count: null, methods: [] };

  try {
    const response = await fetch(`${API_URL}/stripe/payment-methods/${customerId}`, {
      headers: getAuthHeader()
    });

    if (!response.ok) return { success: false, count: null, methods: [] };

    const data = await response.json();
    return {
      success: true,
      count: data.count,
      methods: data.methods
    };
  } catch (error) {
    console.error('Error fetching customer payment methods:', error);
    return { success: false, count: null, methods: [] };
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

export async function getSubscriptionRecovery(view = 'open', cursor = null, signal) {
  const params = new URLSearchParams({ view });
  if (cursor) params.set('cursor', cursor);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetch(`${API_URL}/stripe/subscription-recovery?${params}`, { headers: getAuthHeader(), signal: controller.signal });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Could not refresh invoices.');
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(controller.signal.aborted ? 'Stripe took too long to respond. The next refresh will try again.' : error.message);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export async function fallbackRequest(path = '', options = {}) {
  const response = await fetch(`${API_URL}/fallback${path}`, { ...options, headers: getAuthHeader(), signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not update card fallback.');
  return data;
}

export async function paymentBatchRequest(path, { signal, ...options } = {}) {
  const controller = new AbortController();
  const abort=()=>controller.abort();
  if(signal?.aborted)abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,30000);
  try{
    const response=await fetch(`${API_URL}/payment-batches${path}`,{...options,headers:getAuthHeader(),signal:controller.signal});
    const data=await response.json();
    if(!response.ok||!data.success)throw new Error(data.error||'The request could not be completed.');
    return data;
  }catch(error){
    if(signal?.aborted)throw error;
    throw new Error(controller.signal.aborted?'The request took too long. Refresh the run status before starting again.':error.message);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

export async function statsRequest(path,{signal}={}) {
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,30000);
  try{
    const response=await fetch(`${API_URL}/stats${path}`,{headers:getAuthHeader(),signal:controller.signal});
    const data=await response.json();
    if(!response.ok||!data.success)throw new Error(data.error||'Could not load recovery history.');
    return data;
  }catch(error){
    if(signal?.aborted)throw error;
    throw new Error(controller.signal.aborted?'The server took too long. Please try again.':error.message);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
