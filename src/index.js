import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppRoutes from './AppRoutes';
import './atelier.css';
import './pages/Studio.css';
import './pages/Light.css';
import './pages/Professional.css';
import './pages/CollectionsDesk.css';
import './pages/BrightAccent.css';
import './pages/CeramicApp.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
);