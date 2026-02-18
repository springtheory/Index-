// Vercel serverless handler - routes all /api/* requests through Express
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../server/db');
const { requireAuth } = require('../server/middleware/auth');

const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
getDb();

// Public routes
app.use('/api/auth', require('../server/routes/auth'));
app.use('/api/whatsapp', require('../server/routes/whatsapp'));

// Protected routes
app.use('/api/voice', requireAuth, require('../server/routes/voice'));
app.use('/api/items', requireAuth, require('../server/routes/items'));
app.use('/api/containers', requireAuth, require('../server/routes/containers'));
app.use('/api/locations', requireAuth, require('../server/routes/locations'));
app.use('/api/stats', requireAuth, require('../server/routes/stats'));

const ai = require('../server/services/ai');

app.post('/api/command', requireAuth, async (req, res) => {
  try {
    const { text, source = 'app' } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    const command = await ai.processCommand(text, source);
    res.json(command);
  } catch (err) {
    console.error('Command error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
