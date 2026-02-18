const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const ai = require('../services/ai');
const inventory = require('../services/inventory');

const router = express.Router();

// Configure multer for large voice file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `voice_${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max (for 2-hour recordings)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg',
      'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/flac', 'audio/aac',
      'video/webm', 'video/mp4', // browsers sometimes tag audio recordings as video
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|webm|ogg|m4a|mp4|flac|aac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`), false);
    }
  },
});

// Upload a voice note
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const db = getDb();
    const voiceNote = db
      .prepare(
        `INSERT INTO voice_notes (household_id, uploaded_by, filename, original_name, file_size, status)
         VALUES (?, ?, ?, ?, ?, 'uploaded')`
      )
      .run(req.householdId, req.userId, req.file.filename, req.file.originalname, req.file.size);

    const voiceNoteId = voiceNote.lastInsertRowid;

    res.json({
      id: voiceNoteId,
      filename: req.file.filename,
      size: req.file.size,
      status: 'uploaded',
      message: 'Voice note uploaded successfully. Processing will begin shortly.',
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Process a voice note (transcribe + catalogue)
router.post('/:id/process', async (req, res) => {
  const db = getDb();
  const voiceNoteId = req.params.id;

  try {
    const voiceNote = db.prepare('SELECT * FROM voice_notes WHERE id = ? AND household_id = ?').get(voiceNoteId, req.householdId);
    if (!voiceNote) {
      return res.status(404).json({ error: 'Voice note not found' });
    }

    if (voiceNote.status === 'processing') {
      return res.status(409).json({ error: 'Voice note is already being processed' });
    }

    // Mark as processing
    db.prepare("UPDATE voice_notes SET status = 'processing' WHERE id = ? AND household_id = ?").run(voiceNoteId, req.householdId);

    // Send immediate response
    res.json({
      id: voiceNoteId,
      status: 'processing',
      message: 'Processing started. Use GET /api/voice/:id/status to check progress.',
    });

    // Process in background
    processVoiceNote(req.householdId, req.userId, voiceNoteId, voiceNote.filename).catch((err) => {
      console.error('Background processing error:', err);
      db.prepare("UPDATE voice_notes SET status = 'error', error = ? WHERE id = ? AND household_id = ?").run(
        err.message,
        voiceNoteId,
        req.householdId
      );
    });
  } catch (err) {
    console.error('Process error:', err);
    db.prepare("UPDATE voice_notes SET status = 'error', error = ? WHERE id = ? AND household_id = ?").run(
      err.message,
      voiceNoteId,
      req.householdId
    );
    res.status(500).json({ error: err.message });
  }
});

// Background voice note processing
async function processVoiceNote(householdId, userId, voiceNoteId, filename) {
  const db = getDb();
  const filePath = path.join(__dirname, '..', '..', 'uploads', filename);

  try {
    // Step 1: Transcribe
    console.log(`[Voice ${voiceNoteId}] Transcribing...`);
    const transcription = await ai.transcribeAudio(filePath);

    db.prepare(
      "UPDATE voice_notes SET transcript = ?, duration_seconds = ?, status = 'transcribed' WHERE id = ? AND household_id = ?"
    ).run(transcription.text, Math.round(transcription.duration || 0), voiceNoteId, householdId);

    console.log(`[Voice ${voiceNoteId}] Transcribed. Length: ${transcription.text.length} chars`);

    // Step 2: Parse into inventory items
    console.log(`[Voice ${voiceNoteId}] Parsing inventory...`);
    const parsed = await ai.parseTranscriptChunked(transcription.text);

    db.prepare("UPDATE voice_notes SET parsed_data = ?, status = 'parsed' WHERE id = ? AND household_id = ?").run(
      JSON.stringify(parsed),
      voiceNoteId,
      householdId
    );

    console.log(
      `[Voice ${voiceNoteId}] Parsed: ${(parsed.items || []).length} items, ` +
        `${(parsed.containers || []).length} containers, ${(parsed.locations || []).length} locations`
    );

    // Step 3: Store in database
    console.log(`[Voice ${voiceNoteId}] Storing inventory...`);
    const storeResults = inventory.bulkCreateItems(householdId, userId, parsed);

    db.prepare(
      "UPDATE voice_notes SET status = 'completed', processed_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?"
    ).run(voiceNoteId, householdId);

    inventory.logActivity(householdId, userId, 'process', 'voice_note', voiceNoteId, {
      items_created: storeResults.items.length,
      containers_created: storeResults.containers.length,
      locations_created: storeResults.locations.length,
      errors: storeResults.errors.length,
    });

    console.log(
      `[Voice ${voiceNoteId}] Complete! Created ${storeResults.items.length} items, ` +
        `${storeResults.containers.length} containers, ${storeResults.locations.length} locations`
    );
  } catch (err) {
    console.error(`[Voice ${voiceNoteId}] Processing failed:`, err);
    db.prepare("UPDATE voice_notes SET status = 'error', error = ? WHERE id = ? AND household_id = ?").run(
      err.message,
      voiceNoteId,
      householdId
    );
    throw err;
  }
}

// Get voice note status
router.get('/:id/status', (req, res) => {
  const db = getDb();
  const voiceNote = db.prepare('SELECT * FROM voice_notes WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);

  if (!voiceNote) {
    return res.status(404).json({ error: 'Voice note not found' });
  }

  const response = {
    id: voiceNote.id,
    status: voiceNote.status,
    filename: voiceNote.original_name,
    fileSize: voiceNote.file_size,
    durationSeconds: voiceNote.duration_seconds,
    createdAt: voiceNote.created_at,
    processedAt: voiceNote.processed_at,
    error: voiceNote.error,
  };

  if (voiceNote.status === 'completed' && voiceNote.parsed_data) {
    const parsed = JSON.parse(voiceNote.parsed_data);
    response.summary = {
      locationsFound: (parsed.locations || []).length,
      containersFound: (parsed.containers || []).length,
      itemsFound: (parsed.items || []).length,
    };
  }

  res.json(response);
});

// Get all voice notes
router.get('/', (req, res) => {
  const db = getDb();
  const voiceNotes = db
    .prepare('SELECT id, original_name, file_size, duration_seconds, status, error, created_at, processed_at FROM voice_notes WHERE household_id = ? ORDER BY created_at DESC')
    .all(req.householdId);
  res.json(voiceNotes);
});

// Get transcript
router.get('/:id/transcript', (req, res) => {
  const db = getDb();
  const voiceNote = db.prepare('SELECT id, transcript, status FROM voice_notes WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);

  if (!voiceNote) return res.status(404).json({ error: 'Voice note not found' });
  if (!voiceNote.transcript) return res.status(404).json({ error: 'No transcript available' });

  res.json({ id: voiceNote.id, transcript: voiceNote.transcript });
});

module.exports = router;
