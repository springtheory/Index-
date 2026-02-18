const express = require('express');
const inventory = require('../services/inventory');

const router = express.Router();

// Get all locations
router.get('/', (req, res) => {
  const locations = inventory.getAllLocations(req.householdId);
  res.json(locations);
});

// Get single location with containers and items
router.get('/:id', (req, res) => {
  const location = inventory.getLocation(req.householdId, req.params.id);
  if (!location) return res.status(404).json({ error: 'Location not found' });

  const containers = inventory.getContainersByLocation(req.householdId, req.params.id);
  const items = inventory.getItemsByLocation(req.householdId, req.params.id);
  res.json({ ...location, containers, items });
});

// Create location
router.post('/', (req, res) => {
  const { name, description, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Location name is required' });

  const location = inventory.createLocation(req.householdId, name, description, parent_id);
  res.status(201).json(location);
});

module.exports = router;
