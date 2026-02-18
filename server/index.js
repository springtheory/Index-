require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, closeDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
getDb();
console.log('Database initialized');

// API Routes
app.use('/api/voice', require('./routes/voice'));
app.use('/api/items', require('./routes/items'));
app.use('/api/containers', require('./routes/containers'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/stats', require('./routes/stats'));

// Natural language command endpoint (used by both app and WhatsApp)
const ai = require('./services/ai');
const inventory = require('./services/inventory');

app.post('/api/command', async (req, res) => {
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
