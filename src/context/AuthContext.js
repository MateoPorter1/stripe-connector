import { authFetch } from '../services/authFetch';
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').trim().replace(/\/$/, '');

  // Verificar si hay un usuario autenticado al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('token');

      if (savedToken) {
        try {
          const response = await authFetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            setToken(savedToken);
          } else if (response.status === 401 || response.status === 403) {
            // Only invalid credentials should clear a saved session.
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          console.error('Error verificando autenticación:', error);
          // Preserve the saved session during a temporary server outage.
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, [API_URL]);

  const login = async (email, password) => {
    try {
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

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
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
