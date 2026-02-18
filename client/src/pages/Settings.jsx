import React, { useState } from 'react';
import { changePassword, setPin } from '../services/api';

export default function Settings({ user, household, addToast }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [settingPin, setSettingPin] = useState(false);

  const [codeCopied, setCodeCopied] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      addToast('New password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      addToast('Password changed. All other sessions logged out.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSetPin = async (e) => {
    e.preventDefault();
    if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      addToast('PIN must be 4-8 digits', 'error');
      return;
    }
    if (pin !== confirmPin) {
      addToast('PINs do not match', 'error');
      return;
    }

    setSettingPin(true);
    try {
      await setPin(pin);
      addToast('PIN set successfully', 'success');
      setPinValue('');
      setConfirmPin('');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSettingPin(false);
    }
  };

  const copyInviteCode = () => {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode).then(() => {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Household and account settings</p>
      </div>

      {/* Household info */}
      {household && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Household</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Name</span>
              <span style={{ fontWeight: 600 }}>{household.name}</span>
            </div>

            {/* Invite code - prominent */}
            <div style={{
              background: 'var(--accent-dim)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                Invite Code &mdash; share with your household member
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  letterSpacing: '0.15em',
                  color: 'var(--accent)',
                  fontFamily: 'monospace',
                }}>
                  {household.inviteCode}
                </span>
                <button
                  className="btn"
                  onClick={copyInviteCode}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  {codeCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Members */}
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                Members ({household.members?.length || 0})
              </div>
              {(household.members || []).map((m) => (
                <div key={m.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  fontSize: '0.9rem',
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}>
                    {(m.name || m.email)[0].toUpperCase()}
                  </div>
                  <span>{m.name || m.email}</span>
                  {m.id === user.id && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(you)</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Account info */}
      <div className="card" style={{ maxWidth: 560, marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Account</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Email</span>
            <span>{user.email}</span>
          </div>
          {user.name && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Name</span>
              <span>{user.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="card" style={{ maxWidth: 560, marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Change Password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label>Current Password</label>
            <input className="form-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input className="form-input" type="password" placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={changingPassword}>
            {changingPassword ? <div className="spinner" /> : 'Change Password'}
          </button>
        </form>
      </div>

      {/* PIN setup */}
      <div className="card" style={{ maxWidth: 560, marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Quick-Access PIN</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
          Set a 4-8 digit PIN for quick access on your phone.
        </p>
        <form onSubmit={handleSetPin}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>PIN</label>
              <input className="form-input" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} placeholder="4-8 digits" value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))} required />
            </div>
            <div className="form-group">
              <label>Confirm PIN</label>
              <input className="form-input" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} placeholder="Re-enter PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} required />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={settingPin}>
            {settingPin ? <div className="spinner" /> : 'Set PIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
