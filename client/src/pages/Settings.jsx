import React, { useState } from 'react';
import { changePassword, setPin } from '../services/api';

export default function Settings({ user, addToast }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [settingPin, setSettingPin] = useState(false);

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

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Account settings</p>
      </div>

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
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 12 }}>
          Share this login with your household to access the same inventory from multiple devices.
        </p>
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
