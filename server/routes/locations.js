const express = require('express');
const inventory = require('../services/inventory');

const router = express.Router();

// Get all locations
router.get('/', (req, res) => {
  const locations = inventory.getAllLocations();
  res.json(locations);
});

// Get single location with containers and items
router.get('/:id', (req, res) => {
  const location = inventory.getLocation(req.params.id);
  if (!location) return res.status(404).json({ error: 'Location not found' });

  const containers = inventory.getContainersByLocation(req.params.id);
  const items = inventory.getItemsByLocation(req.params.id);
  res.json({ ...location, containers, items });
});

// Create location
router.post('/', (req, res) => {
  const { name, description, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Location name is required' });

  const location = inventory.createLocation(name, description, parent_id);
  res.status(201).json(location);
});

module.exports = router;
