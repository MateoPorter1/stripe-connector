import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading, sessionError, retrySession, logout } = useAuth();

  if (loading || sessionError) {
    return <main className="session-screen">
      <section className="auth-box session-box" aria-busy={loading}>
        <p className="session-brand">↺ Revenue recovery</p>
        {loading ? <>
          <div className="spinner-large" aria-hidden="true" />
          <h1>Opening your workspace</h1>
          <p role="status">Connecting to your workspace and checking your saved login.</p>
        </> : <>
          <h1>Couldn’t reach your workspace</h1>
          <p role="alert">{sessionError}</p>
          <p>Your saved login is preserved. The server may still be waking up.</p>
          <button className="auth-button" onClick={retrySession}>Try again</button>
          <button className="quick-filter-btn" onClick={logout}>Back to sign in</button>
        </>}
      </section>
    </main>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default PrivateRoute;
