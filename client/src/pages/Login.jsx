import React, { useState } from 'react';
import { login, signup, setToken } from '../services/api';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login', 'signup-new', 'signup-join'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }

    if (mode !== 'login') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (mode === 'signup-join' && !inviteCode.trim()) {
        setError('Enter the invite code from your household member');
        return;
      }
    }

    setLoading(true);
    try {
      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        result = await signup(email, password, name, {
          inviteCode: mode === 'signup-join' ? inviteCode.trim() : undefined,
          householdName: mode === 'signup-new' ? (householdName.trim() || 'My Home') : undefined,
        });
      }

      setToken(result.token);
      localStorage.setItem('index_user', JSON.stringify(result.user));
      if (result.household) {
        localStorage.setItem('index_household', JSON.stringify(result.household));
      }
      onAuth(result.user, result.household);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode !== 'login';

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
            {mode === 'login' ? 'Welcome back' : mode === 'signup-new' ? 'Create your household' : 'Join a household'}
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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

            {mode === 'signup-new' && (
              <div className="form-group">
                <label>Household Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. The Smith House"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                />
              </div>
            )}

            {mode === 'signup-join' && (
              <div className="form-group">
                <label>Invite Code</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. A1B2C3"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase' }}
                  required
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                  Get this from your household member in Settings
                </p>
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
              {loading ? <div className="spinner" /> : mode === 'login' ? 'Log In' : mode === 'signup-new' ? 'Create Household' : 'Join Household'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem' }}>
            {mode === 'login' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Don't have an account?</span>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                  <button
                    style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}
                    onClick={() => { setMode('signup-new'); setError(''); }}
                  >
                    New household
                  </button>
                  <button
                    style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}
                    onClick={() => { setMode('signup-join'); setError(''); }}
                  >
                    Join existing
                  </button>
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <button
                  style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}
                  onClick={() => { setMode('login'); setError(''); }}
                >
                  Log in
                </button>
              </span>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 24 }}>
          Both household members share the same inventory.
        </p>
      </div>
    </div>
  );
}
