const express = require('express');
const inventory = require('../services/inventory');

const router = express.Router();

// Get all containers
router.get('/', (req, res) => {
  const containers = inventory.getAllContainers(req.householdId);
  res.json(containers);
});

// Get single container with items
router.get('/:id', (req, res) => {
  const container = inventory.getContainer(req.householdId, req.params.id);
  if (!container) return res.status(404).json({ error: 'Container not found' });

  const items = inventory.getItemsByContainer(req.householdId, req.params.id);
  res.json({ ...container, items });
});

// Create container
router.post('/', (req, res) => {
  const { label, type, color, size, description, location_id } = req.body;
  if (!label) return res.status(400).json({ error: 'Container label is required' });

  const container = inventory.createContainer(req.householdId, { label, type, color, size, description, location_id });
  res.status(201).json(container);
});

// Get containers by location
router.get('/location/:id', (req, res) => {
  const containers = inventory.getContainersByLocation(req.householdId, req.params.id);
  res.json(containers);
});

module.exports = router;
