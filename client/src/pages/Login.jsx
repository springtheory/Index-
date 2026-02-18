import React, { useState } from 'react';
import { login, signup, setToken } from '../services/api';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        result = await signup(email, password, name);
      }

      setToken(result.token);
      localStorage.setItem('index_user', JSON.stringify(result.user));
      onAuth(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.03em',
          }}>
            Index
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            AI-Powered Home Inventory
          </p>
        </div>

        {/* Auth card */}
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: 24, textAlign: 'center' }}>
            {isSignup ? 'Create Account' : 'Welcome back'}
          </h2>

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <div className="form-group">
                <label>Your Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="form-group">
              <label>Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                className="form-input"
                type="password"
                placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {isSignup && (
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--danger-dim)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: '1rem' }}
            >
              {loading ? <div className="spinner" /> : isSignup ? 'Create Account' : 'Log In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem' }}>
            {isSignup ? (
              <span style={{ color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <button
                  style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}
                  onClick={() => { setMode('login'); setError(''); }}
                >
                  Log in
                </button>
              </span>
            ) : (
              <span style={{ color: 'var(--text-secondary)' }}>
                Don't have an account?{' '}
                <button
                  style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}
                  onClick={() => { setMode('signup'); setError(''); }}
                >
                  Sign up
                </button>
              </span>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 24 }}>
          Share this login with your household to access the same inventory.
        </p>
      </div>
    </div>
  );
}
