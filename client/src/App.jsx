import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import VoiceUpload from './pages/VoiceUpload';
import Inventory from './pages/Inventory';
import Containers from './pages/Containers';
import Locations from './pages/Locations';
import AddItem from './pages/AddItem';
import WhatsAppSetup from './pages/WhatsAppSetup';
import Login from './pages/Login';
import Settings from './pages/Settings';
import Toast from './components/Toast';
import { getToken, getMe, logout as apiLogout, clearAuth } from './services/api';

// Simple SVG icons
const Icons = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  mic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  container: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6v16l11 2 11-2V6"/><path d="M1 6l11 2 11-2"/><path d="M12 8V24"/><path d="M1 6l11-4 11 4"/></svg>,
  location: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  whatsapp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('index_user')); } catch { return null; }
  });
  const [household, setHousehold] = useState(() => {
    try { return JSON.parse(localStorage.getItem('index_household')); } catch { return null; }
  });
  const [authChecked, setAuthChecked] = useState(false);

  // Verify existing token on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      getMe()
        .then((data) => {
          setUser(data.user);
          localStorage.setItem('index_user', JSON.stringify(data.user));
          if (data.household) {
            setHousehold(data.household);
            localStorage.setItem('index_household', JSON.stringify(data.household));
          }
        })
        .catch(() => {
          clearAuth();
          setUser(null);
          setHousehold(null);
        })
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }

    // Listen for forced logouts (expired tokens)
    const handleLogout = () => {
      setUser(null);
      addToast('Session expired. Please log in again.', 'error');
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const handleAuth = (userData, householdData) => {
    setUser(userData);
    if (householdData) {
      setHousehold(householdData);
      localStorage.setItem('index_household', JSON.stringify(householdData));
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    setHousehold(null);
    localStorage.removeItem('index_household');
    addToast('Logged out', 'info');
  };

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return (
      <>
        <Login onAuth={handleAuth} />
        <Toast toasts={toasts} />
      </>
    );
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Icons.dashboard },
    { path: '/search', label: 'Search', icon: Icons.search },
    { path: '/voice', label: 'Voice Upload', icon: Icons.mic },
    { path: '/inventory', label: 'All Items', icon: Icons.box },
    { path: '/containers', label: 'Containers', icon: Icons.container },
    { path: '/locations', label: 'Locations', icon: Icons.location },
    { path: '/add', label: 'Add Item', icon: Icons.plus },
    { path: '/whatsapp', label: 'WhatsApp Setup', icon: Icons.whatsapp },
    { path: '/settings', label: 'Settings', icon: Icons.settings },
  ];

  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Mobile header */}
        <div className="mobile-header">
          <button onClick={() => setSidebarOpen(true)}>{Icons.menu}</button>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Index</span>
        </div>

        {/* Sidebar overlay */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-logo">
              Index<span>Inventory</span>
            </div>
          </div>

          <div className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {user.name || user.email}
              {household && <span style={{ opacity: 0.6 }}> &middot; {household.name}</span>}
            </div>
            <button
              className="nav-item"
              onClick={handleLogout}
              style={{ color: 'var(--danger)', padding: '8px 16px' }}
            >
              {Icons.logout}
              Log Out
            </button>
          </div>
        </nav>

        {/* Main */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard addToast={addToast} />} />
            <Route path="/search" element={<Search addToast={addToast} />} />
            <Route path="/voice" element={<VoiceUpload addToast={addToast} />} />
            <Route path="/inventory" element={<Inventory addToast={addToast} />} />
            <Route path="/containers" element={<Containers addToast={addToast} />} />
            <Route path="/locations" element={<Locations addToast={addToast} />} />
            <Route path="/add" element={<AddItem addToast={addToast} />} />
            <Route path="/whatsapp" element={<WhatsAppSetup />} />
            <Route path="/settings" element={<Settings user={user} household={household} addToast={addToast} />} />
          </Routes>
        </main>

        {/* Toasts */}
        <Toast toasts={toasts} />
      </div>
    </BrowserRouter>
  );
}
