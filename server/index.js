require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDb, closeDb } = require('./db');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN || false
    : true,
  credentials: true,
}));

// Rate limiting - general API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/pin/verify', authLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
getDb();
console.log('Database initialized');

// === PUBLIC ROUTES (no auth required) ===
app.use('/api/auth', require('./routes/auth'));

// WhatsApp webhook is public (Twilio needs to reach it), but verified by Twilio signature
app.use('/api/whatsapp', require('./routes/whatsapp'));

// === PROTECTED ROUTES (auth required) ===
app.use('/api/voice', requireAuth, require('./routes/voice'));
app.use('/api/items', requireAuth, require('./routes/items'));
app.use('/api/containers', requireAuth, require('./routes/containers'));
app.use('/api/locations', requireAuth, require('./routes/locations'));
app.use('/api/stats', requireAuth, require('./routes/stats'));

// Natural language command endpoint
const ai = require('./services/ai');

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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Index server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set. Authentication will fail. Set it in .env');
  }
  if (process.env.OPENAI_API_KEY) {
    console.log('OpenAI API: Connected');
  } else {
    console.log('OpenAI API: Not configured (set OPENAI_API_KEY in .env)');
  }
  if (process.env.TWILIO_ACCOUNT_SID) {
    console.log('Twilio WhatsApp: Configured');
  } else {
    console.log('Twilio WhatsApp: Not configured (set TWILIO_* in .env)');
  }
});
