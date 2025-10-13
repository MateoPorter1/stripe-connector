import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import './Admin.css';

const Admin = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Verificar que el usuario sea admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Cargar datos
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener usuarios
        const usersResponse = await fetch(`${API_URL}/admin/users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!usersResponse.ok) {
          throw new Error('Error loading users');
        }

        const usersData = await usersResponse.json();
        setUsers(usersData.users);

        // Get statistics
        const statsResponse = await fetch(`${API_URL}/admin/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!statsResponse.ok) {
          throw new Error('Error loading statistics');
        }

        const statsData = await statsResponse.json();
        setStats(statsData.stats);

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    if (token && user?.role === 'admin') {
      fetchData();
    }
  }, [token, user, API_URL]);

  const handlePlanChange = async (userId, newPlan) => {
    try {
      setSuccessMessage('');
      setError('');

      const response = await fetch(`${API_URL}/admin/users/${userId}/plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: newPlan })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error updating plan');
      }

      // Update users list
      setUsers(users.map(u =>
        u.id === userId ? { ...u, plan: data.user.plan, planExpiry: data.user.planExpiry } : u
      ));

      setSuccessMessage(`Plan updated to ${newPlan}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="admin-layout">
        <Sidebar />
        <div className="admin-content">
          <div className="loading">Loading admin panel...</div>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-content">
        <div className="admin-container">
          <div className="admin-header">
            <div>
              <h1>Admin Panel</h1>
              <p>Welcome, {user.name}</p>
            </div>
          </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Statistics */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>{stats.totalUsers}</h3>
            <p>Total Users</p>
          </div>
          <div className="stat-card">
            <h3>{stats.freeUsers}</h3>
            <p>Free Plan</p>
          </div>
          <div className="stat-card">
            <h3>{stats.premiumUsers}</h3>
            <p>Premium Plan</p>
          </div>
          <div className="stat-card">
            <h3>{stats.adminUsers}</h3>
            <p>Administrators</p>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="users-section">
        <h2>User Management</h2>
        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Current Plan</th>
                <th>Registration Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge badge-${u.role}`}>
                      {u.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${u.plan}`}>
                      {u.plan === 'free' ? 'Free' : 'Premium'}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <select
                      value={u.plan}
                      onChange={(e) => handlePlanChange(u.id, e.target.value)}
                      className="plan-select"
                      disabled={u.id === user.id}
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
