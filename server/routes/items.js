const express = require('express');
const inventory = require('../services/inventory');
const ai = require('../services/ai');

const router = express.Router();

// Get all items (paginated)
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const items = inventory.getAllItems(limit, offset);
  res.json({ items, limit, offset, total: items.length });
});

// Search items - AI-powered smart search
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Search query required (q parameter)' });

    // First try quick local search
    const quickResults = inventory.quickSearch(query);

    // If quick search found good results and no AI key, return those
    if (!process.env.OPENAI_API_KEY && quickResults.length > 0) {
      return res.json({
        results: quickResults,
        message: `Found ${quickResults.length} items matching "${query}"`,
        searchType: 'local',
      });
    }

    // Use AI search for smart matching
    if (process.env.OPENAI_API_KEY) {
      const aiResults = await ai.aiSearch(query);
      return res.json({ ...aiResults, searchType: 'ai' });
    }

    res.json({
      results: quickResults,
      message: quickResults.length > 0
        ? `Found ${quickResults.length} items`
        : 'No items found. Try different search terms.',
      searchType: 'local',
    });
  } catch (err) {
    console.error('Search error:', err);
    // Fallback to quick search on AI error
    const quickResults = inventory.quickSearch(req.query.q);
    res.json({
      results: quickResults,
      message: `Found ${quickResults.length} items (basic search)`,
      searchType: 'local',
    });
  }
});

// Get single item
router.get('/:id', (req, res) => {
  const item = inventory.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// Add new item
router.post('/', async (req, res) => {
  try {
    const { name, description, category, quantity, container_id, location_id, tags, aliases, notes, force } = req.body;

    if (!name) return res.status(400).json({ error: 'Item name is required' });

    const result = await inventory.createItem(
      { name, description, category, quantity, container_id, location_id, tags, aliases, notes },
      'app',
      force === true
    );

    if (result.duplicate) {
      return res.status(409).json({
        error: 'Possible duplicate item detected',
        ...result,
        hint: 'Set "force": true to add anyway',
      });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update item
router.put('/:id', (req, res) => {
  const item = inventory.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const updated = inventory.updateItem(req.params.id, req.body);
  res.json(updated);
});

// Move item
router.post('/:id/move', (req, res) => {
  const { container_id, location_id } = req.body;
  const item = inventory.moveItem(req.params.id, container_id || null, location_id || null);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// Delete item
router.delete('/:id', (req, res) => {
  const item = inventory.deleteItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ message: 'Item deleted', item });
});

// Get items by container
router.get('/container/:id', (req, res) => {
  const items = inventory.getItemsByContainer(req.params.id);
  res.json(items);
});

// Get items by location
router.get('/location/:id', (req, res) => {
  const items = inventory.getItemsByLocation(req.params.id);
  res.json(items);
});

// Get items by category
router.get('/category/:category', (req, res) => {
  const items = inventory.getItemsByCategory(req.params.category);
  res.json(items);
});

module.exports = router;
