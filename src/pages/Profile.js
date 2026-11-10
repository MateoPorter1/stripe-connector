import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import StripeConnectionPanel from '../components/StripeConnectionPanel';
import './Profile.css';
export default function Profile() {
  const { user } = useAuth();
  return <div className="profile-layout"><Sidebar/><main className="profile-content"><div className="profile-container">
    <header className="profile-header"><h1>Workspace settings</h1><p>Manage your account and Stripe connection</p></header>
    <section className="profile-section"><h2 className="section-title">Account details</h2><div className="info-grid">
      <div className="info-item"><label>Name</label><div className="info-value">{user?.name}</div></div>
      <div className="info-item"><label>Email</label><div className="info-value">{user?.email}</div></div>
      <div className="info-item"><label>Subscription</label><div className="info-value"><Link to="/billing">Manage subscription & billing →</Link></div></div>
      <div className="info-item"><label>Role</label><div className="info-value">{user?.role === 'admin' ? 'Administrator' : 'Member'}</div></div>
    </div></section><StripeConnectionPanel/>
  </div></main></div>;
}
