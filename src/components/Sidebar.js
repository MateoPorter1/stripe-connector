import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LuHouse, LuCreditCard, LuUser, LuShield, LuLogOut, LuStar, LuCircle, LuLayers } from 'react-icons/lu';
import './Sidebar.css';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    {
      path: '/home',
      icon: LuHouse,
      label: 'Overview',
      description: 'Collections and payment history'
    },
    {
      path: '/dashboard',
      icon: LuCreditCard,
      label: 'Recovery queue',
      description: 'Filter and run once'
    },
    {
      path: '/profile',
      icon: LuUser,
      label: 'Stripe & settings',
      description: 'Settings and API'
    }
  ];

  // Only show admin panel if user is admin
  if (user?.role === 'admin') {
    menuItems.push({
      path: '/admin',
      icon: LuShield,
      label: 'Admin Panel',
      description: 'User management'
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
        <h2 className="sidebar-title"><span className="brand-symbol" aria-hidden="true"><LuLayers/></span><span className="brand-name">Recovery</span></h2>
        <div className="user-info-sidebar">
          <span className="user-avatar" aria-hidden="true">{(user?.name||user?.email||'W').slice(0,1).toUpperCase()}</span><div><div className="user-name">{user?.name || user?.email}</div>
          <div className={`user-plan plan-${user?.plan || 'free'}`}>
            {user?.plan === 'premium' ? (
              <>
                <LuStar size={12} /> Premium
              </>
            ) : (
              <>
                <LuCircle size={12} /> Free
              </>
            )}
          </div></div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              aria-label={item.label}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <span className="nav-icon"><IconComponent /></span>
              <div className="nav-content">
                <div className="nav-label">{item.label}</div>
                <div className="nav-description">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn" aria-label="Sign out">
          <span className="nav-icon"><LuLogOut /></span>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
