import RecoveryLogo from '../components/RecoveryLogo';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password, setStatus);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <aside className="recovery-intro">
        <a className="recovery-brand" href="/"><RecoveryLogo/></a>
        <div><h2>Failed payments shouldn’t become lost customers.</h2><p>Review failed subscription payments, retry saved cards, and follow every collection back to Stripe.</p>
        <div className="recovery-flow"><span>Review failures</span><span>Start a run</span><span>Trace every result</span></div></div>
        <p>Your workspace for payment recovery.</p>
      </aside><div className="auth-box">
        <a className="auth-mobile-brand" href="/" aria-label="Rebound home"><RecoveryLogo/></a>
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Sign in to your recovery workspace.</p>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {loading && <p role="status" aria-live="polite">{status} A server startup can take up to a minute. Keep this page open.</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email" autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password" autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? status || 'Connecting…' : 'Sign In'}
          </button>
        </form>

        <p className="auth-link">
          Don't have an account? <Link to="/signup">Sign up here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
