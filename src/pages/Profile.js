import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { LuUser, LuClipboard, LuStar, LuCircle, LuShield, LuKey, LuCircleCheckBig, LuTriangleAlert, LuTrash2, LuInfo, LuEye, LuEyeOff, LuSave } from 'react-icons/lu';
import './Profile.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Profile() {
  const { user } = useAuth();
  const [stripeApiKey, setStripeApiKey] = useState('');
  const [hasConfiguredStripe, setHasConfiguredStripe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchStripeStatus();
  }, []);

  const fetchStripeStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profile/stripe-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHasConfiguredStripe(data.hasConfiguredStripe);
      }
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profile/stripe-key`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stripeApiKey })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || '✅ API key saved successfully' });
        setHasConfiguredStripe(true);
        setStripeApiKey('');
        setShowKey(false);
      } else {
        setMessage({ type: 'error', text: data.error || '❌ Error saving API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Connection error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!window.confirm('Are you sure you want to delete your Stripe API key?')) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profile/stripe-key`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || '✅ API key deleted successfully' });
        setHasConfiguredStripe(false);
        setStripeApiKey('');
      } else {
        setMessage({ type: 'error', text: data.error || '❌ Error deleting API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Connection error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-layout">
      <Sidebar />
      <div className="profile-content">
        <div className="profile-container">
          <div className="profile-header">
            <h1><LuUser style={{ display: 'inline', marginRight: '8px' }} /> My Profile</h1>
            <p>Manage your information and Stripe configuration</p>
          </div>

          {/* Información del usuario */}
          <div className="profile-section">
            <h2 className="section-title"><LuClipboard style={{ display: 'inline', marginRight: '8px' }} /> Personal Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Name</label>
                <div className="info-value">{user?.name}</div>
              </div>
              <div className="info-item">
                <label>Email</label>
                <div className="info-value">{user?.email}</div>
              </div>
              <div className="info-item">
                <label>Plan</label>
                <div className="info-value">
                  <span className={`plan-badge-profile plan-${user?.plan || 'free'}`}>
                    {user?.plan === 'premium' ? <><LuStar size={12} /> Premium</> : <><LuCircle size={12} /> Free</>}
                  </span>
                </div>
              </div>
              <div className="info-item">
                <label>Role</label>
                <div className="info-value">
                  <span className={`role-badge ${user?.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                    {user?.role === 'admin' ? <><LuShield size={14} /> Administrator</> : <><LuUser size={14} /> User</>}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuración de Stripe */}
          <div className="profile-section">
            <h2 className="section-title"><LuKey style={{ display: 'inline', marginRight: '8px' }} /> Stripe Configuration</h2>

            <div className="stripe-status">
              <div className="status-indicator">
                <span className={`status-dot ${hasConfiguredStripe ? 'status-active' : 'status-inactive'}`}></span>
                <span className="status-text">
                  {hasConfiguredStripe ? <><LuCircleCheckBig size={16} /> API Key Configured</> : <><LuTriangleAlert size={16} /> API Key Pending</>}
                </span>
              </div>
              {hasConfiguredStripe && (
                <button onClick={handleDeleteApiKey} className="delete-key-btn" disabled={loading}>
                  <LuTrash2 /> Delete API Key
                </button>
              )}
            </div>

            {message.text && (
              <div className={`message ${message.type === 'success' ? 'message-success' : 'message-error'}`}>
                {message.text}
              </div>
            )}

            <div className="stripe-info-box">
              <h3><LuInfo style={{ display: 'inline', marginRight: '8px' }} /> Where do I find my API key?</h3>
              <ol>
                <li>Go to your <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">Stripe Dashboard</a></li>
                <li>In the sidebar, look for "Developers" → "API keys"</li>
                <li>Copy your "Secret key" (starts with <code>sk_test_</code> or <code>sk_live_</code>)</li>
                <li>Paste it in the field below</li>
              </ol>
              <div className="warning-box">
                <LuTriangleAlert style={{ display: 'inline', marginRight: '8px' }} /> <strong>Important:</strong> Never share your API key with anyone. It will be securely saved in your profile.
              </div>
            </div>

            <form onSubmit={handleSaveApiKey} className="api-key-form">
              <div className="form-group-profile">
                <label htmlFor="stripeApiKey">
                  Stripe Secret Key
                  {hasConfiguredStripe && <span className="label-hint">(Update)</span>}
                </label>
                <div className="input-with-toggle">
                  <input
                    id="stripeApiKey"
                    type={showKey ? 'text' : 'password'}
                    value={stripeApiKey}
                    onChange={(e) => setStripeApiKey(e.target.value)}
                    placeholder={hasConfiguredStripe ? 'sk_•••••••••••••••' : 'sk_test_... or sk_live_...'}
                    className="api-key-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="toggle-visibility-btn"
                  >
                    {showKey ? <LuEyeOff /> : <LuEye />}
                  </button>
                </div>
                <small className="input-hint">
                  Must start with "sk_test_" (test mode) or "sk_live_" (production mode)
                </small>
              </div>

              <button type="submit" className="save-button" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner-small"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <LuSave /> {hasConfiguredStripe ? 'Update API Key' : 'Save API Key'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
