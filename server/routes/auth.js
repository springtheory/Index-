const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../db');

const router = express.Router();
const SALT_ROUNDS = 12;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return process.env.JWT_SECRET;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateInviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function createSession(db, userId, email, householdId) {
  const token = jwt.sign({ userId, email, householdId }, getJwtSecret(), { expiresIn: '30d' });
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(userId, tokenHash, expiresAt);
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  return token;
}

// Sign up - creates a new household or joins existing one with invite code
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, inviteCode, householdName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const db = getDb();

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    let householdId;

    if (inviteCode) {
      // Join existing household
      const household = db.prepare('SELECT id FROM households WHERE invite_code = ?').get(inviteCode.toUpperCase().trim());
      if (!household) {
        return res.status(404).json({ error: 'Invalid invite code. Check with your household member.' });
      }
      householdId = household.id;
    } else {
      // Create new household
      const code = generateInviteCode();
      const hName = householdName || 'My Home';
      const result = db.prepare('INSERT INTO households (name, invite_code) VALUES (?, ?)').run(hName, code);
      householdId = result.lastInsertRowid;
    }

    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, household_id) VALUES (LOWER(?), ?, ?, ?)'
    ).run(email, passwordHash, name || null, householdId);

    const userId = result.lastInsertRowid;
    const token = createSession(db, userId, email.toLowerCase(), householdId);

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(householdId);
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE household_id = ?').get(householdId).count;

    res.status(201).json({
      token,
      user: { id: userId, email: email.toLowerCase(), name: name || null, householdId },
      household: { id: household.id, name: household.name, inviteCode: household.invite_code, members: memberCount },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Log in
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createSession(db, user.id, user.email, user.household_id);

    db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < CURRENT_TIMESTAMP').run(user.id);

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(user.household_id);
    const memberCount = household
      ? db.prepare('SELECT COUNT(*) as count FROM users WHERE household_id = ?').get(user.household_id).count
      : 0;

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, householdId: user.household_id },
      household: household ? { id: household.id, name: household.name, inviteCode: household.invite_code, members: memberCount } : null,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Log out
router.post('/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const tokenHash = hashToken(token);
      getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.json({ message: 'Logged out' });
  }
});

// Get current user + household info
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, getJwtSecret());

    const tokenHash = hashToken(token);
    const session = getDb().prepare(
      'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP'
    ).get(tokenHash);
    if (!session) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id, email, name, household_id, created_at FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(user.household_id);
    const members = db.prepare('SELECT id, name, email FROM users WHERE household_id = ?').all(user.household_id);

    res.json({
      user: { ...user, householdId: user.household_id },
      household: household ? { id: household.id, name: household.name, inviteCode: household.invite_code, members } : null,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// PIN endpoints
router.post('/pin', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(authHeader.slice(7), getJwtSecret());
    const { pin } = req.body;
    if (!pin || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    }

    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
    getDb().prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, decoded.userId);
    res.json({ message: 'PIN set successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

router.post('/pin/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(authHeader.slice(7), getJwtSecret());
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN is required' });

    const user = getDb().prepare('SELECT pin_hash FROM users WHERE id = ?').get(decoded.userId);
    if (!user || !user.pin_hash) return res.status(400).json({ error: 'No PIN set' });

    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid PIN' });
    res.json({ message: 'PIN verified' });
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, getJwtSecret());
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords are required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, decoded.userId);

    const currentTokenHash = hashToken(token);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(decoded.userId, currentTokenHash);
    res.json({ message: 'Password changed. All other sessions have been logged out.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
