import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LuHouse, LuCreditCard, LuUser, LuShield, LuLogOut, LuStar, LuCircle } from 'react-icons/lu';
import './Sidebar.css';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    {
      path: '/home',
      icon: LuHouse,
      label: 'Home',
      description: 'Main dashboard'
    },
    {
      path: '/dashboard',
      icon: LuCreditCard,
      label: 'Transactions',
      description: 'Failed payments'
    },
    {
      path: '/profile',
      icon: LuUser,
      label: 'My Profile',
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
        <h2 className="sidebar-title">Stripe Connector</h2>
        <div className="user-info-sidebar">
          <div className="user-name">{user?.name || user?.email}</div>
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
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
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
        <button onClick={handleLogout} className="logout-btn">
          <span className="nav-icon"><LuLogOut /></span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
