import { waitForServer } from '../services/serverReady';
import { authFetch } from '../services/authFetch';
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const sessionRequest = useRef(0);

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').trim().replace(/\/$/, '');

  const checkSession = useCallback(async () => {
    const requestId = ++sessionRequest.current;
    const savedToken = localStorage.getItem('token');
    setLoading(true);
    setSessionError('');
    try {
      if (!savedToken) return;
      await waitForServer(API_URL);
      if (requestId !== sessionRequest.current) return;
      const response = await authFetch(`${API_URL}/auth/me`, {
        timeoutMs: 6000,
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      if (requestId !== sessionRequest.current) return;
      if (response.ok) {
        const data = await response.json();
        if (!data.user) throw new Error('Your session could not be checked. Please try again.');
        setUser(data.user);
        setToken(savedToken);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } else {
        throw new Error('The server is temporarily unavailable. Your saved login is still here.');
      }
    } catch (error) {
      if (requestId === sessionRequest.current) setSessionError(error.message);
    } finally {
      if (requestId === sessionRequest.current) setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    checkSession();
    return () => { sessionRequest.current += 1; };
  }, [checkSession]);

  const login = async (email, password, onStatus = () => {}) => {
    try {
      onStatus('Connecting to server…');
      await waitForServer(API_URL);
      onStatus('Signing in…');
      const response = await authFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (response.status >= 500) {
        throw new Error('Sign-in is temporarily unavailable. Please try again shortly.');
      }
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sign-in failed. Check your email and password.');
      }

      sessionRequest.current += 1;
      setSessionError('');
      setLoading(false);
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await authFetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
      });

      if (response.status >= 500) {
        throw new Error('Sign-in is temporarily unavailable. Please try again shortly.');
      }
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not create your account.');
      }

      sessionRequest.current += 1;
      setSessionError('');
      setLoading(false);
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    sessionRequest.current += 1;
    setSessionError('');
    setLoading(false);
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    sessionError,
    retrySession: checkSession,
    login,
    signup,
    logout,
    isAuthenticated: !!token && !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
