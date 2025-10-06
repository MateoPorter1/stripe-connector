import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    {
      path: '/dashboard',
      icon: '📊',
      label: 'Dashboard',
      description: 'Transacciones fallidas'
    },
    {
      path: '/profile',
      icon: '👤',
      label: 'Mi Perfil',
      description: 'Configuración y API'
    }
  ];

  // Solo mostrar panel admin si el usuario es admin
  if (user?.role === 'admin') {
    menuItems.push({
      path: '/admin',
      icon: '🔧',
      label: 'Admin Panel',
      description: 'Gestión de usuarios'
    });
  }

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Stripe Connector</h2>
        <div className="user-info-sidebar">
          <div className="user-name">{user?.name || user?.email}</div>
          <div className={`user-plan plan-${user?.plan || 'free'}`}>
            {user?.plan === 'premium' ? '⭐ Premium' : '🆓 Free'}
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavigation(item.path)}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <div className="nav-content">
              <div className="nav-label">{item.label}</div>
              <div className="nav-description">{item.description}</div>
            </div>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <span className="nav-icon">🚪</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
