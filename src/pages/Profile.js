import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { LuUser, LuClipboard, LuStar, LuCircle, LuShield, LuKey, LuCheckCircle2, LuAlertTriangle, LuTrash2, LuInfo, LuEye, LuEyeOff, LuSave } from 'react-icons/lu';
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
        setMessage({ type: 'success', text: data.message || '✅ API key guardada exitosamente' });
        setHasConfiguredStripe(true);
        setStripeApiKey('');
        setShowKey(false);
      } else {
        setMessage({ type: 'error', text: data.error || '❌ Error al guardar la API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error de conexión. Por favor intenta de nuevo.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar tu API key de Stripe?')) {
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
        setMessage({ type: 'success', text: data.message || '✅ API key eliminada exitosamente' });
        setHasConfiguredStripe(false);
        setStripeApiKey('');
      } else {
        setMessage({ type: 'error', text: data.error || '❌ Error al eliminar la API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error de conexión. Por favor intenta de nuevo.' });
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
            <h1><LuUser style={{ display: 'inline', marginRight: '8px' }} /> Mi Perfil</h1>
            <p>Administra tu información y configuración de Stripe</p>
          </div>

          {/* Información del usuario */}
          <div className="profile-section">
            <h2 className="section-title"><LuClipboard style={{ display: 'inline', marginRight: '8px' }} /> Información Personal</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Nombre</label>
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
                <label>Rol</label>
                <div className="info-value">
                  <span className={`role-badge ${user?.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                    {user?.role === 'admin' ? <><LuShield size={14} /> Administrador</> : <><LuUser size={14} /> Usuario</>}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuración de Stripe */}
          <div className="profile-section">
            <h2 className="section-title"><LuKey style={{ display: 'inline', marginRight: '8px' }} /> Configuración de Stripe</h2>

            <div className="stripe-status">
              <div className="status-indicator">
                <span className={`status-dot ${hasConfiguredStripe ? 'status-active' : 'status-inactive'}`}></span>
                <span className="status-text">
                  {hasConfiguredStripe ? <><LuCheckCircle2 size={16} /> API Key Configurada</> : <><LuAlertTriangle size={16} /> API Key Pendiente</>}
                </span>
              </div>
              {hasConfiguredStripe && (
                <button onClick={handleDeleteApiKey} className="delete-key-btn" disabled={loading}>
                  <LuTrash2 /> Eliminar API Key
                </button>
              )}
            </div>

            {message.text && (
              <div className={`message ${message.type === 'success' ? 'message-success' : 'message-error'}`}>
                {message.text}
              </div>
            )}

            <div className="stripe-info-box">
              <h3><LuInfo style={{ display: 'inline', marginRight: '8px' }} /> ¿Dónde encuentro mi API key?</h3>
              <ol>
                <li>Ve a tu <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">Dashboard de Stripe</a></li>
                <li>En el menú lateral, busca "Developers" → "API keys"</li>
                <li>Copia tu "Secret key" (comienza con <code>sk_test_</code> o <code>sk_live_</code>)</li>
                <li>Pégala en el campo de abajo</li>
              </ol>
              <div className="warning-box">
                <LuAlertTriangle style={{ display: 'inline', marginRight: '8px' }} /> <strong>Importante:</strong> Nunca compartas tu API key con nadie. Se guardará de forma segura en tu perfil.
              </div>
            </div>

            <form onSubmit={handleSaveApiKey} className="api-key-form">
              <div className="form-group-profile">
                <label htmlFor="stripeApiKey">
                  Stripe Secret Key
                  {hasConfiguredStripe && <span className="label-hint">(Actualizar)</span>}
                </label>
                <div className="input-with-toggle">
                  <input
                    id="stripeApiKey"
                    type={showKey ? 'text' : 'password'}
                    value={stripeApiKey}
                    onChange={(e) => setStripeApiKey(e.target.value)}
                    placeholder={hasConfiguredStripe ? 'sk_•••••••••••••••' : 'sk_test_... o sk_live_...'}
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
                  Debe comenzar con "sk_test_" (modo prueba) o "sk_live_" (modo producción)
                </small>
              </div>

              <button type="submit" className="save-button" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner-small"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <LuSave /> {hasConfiguredStripe ? 'Actualizar API Key' : 'Guardar API Key'}
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
