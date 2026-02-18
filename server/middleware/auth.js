const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../db');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server authentication not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const tokenHash = hashToken(token);
    const session = getDb().prepare(
      'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP'
    ).get(tokenHash);

    if (!session) {
      return res.status(401).json({ error: 'Session expired or revoked' });
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = { requireAuth };
