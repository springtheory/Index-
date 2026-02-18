const express = require('express');
const inventory = require('../services/inventory');

const router = express.Router();

// Get overall stats
router.get('/', (req, res) => {
  const stats = inventory.getStats(req.userId);
  res.json(stats);
});

// Get recent activity
router.get('/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const activity = inventory.getRecentActivity(req.userId, limit);
  res.json(activity);
});

module.exports = router;
