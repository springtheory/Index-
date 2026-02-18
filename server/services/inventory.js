const { getDb } = require('../db');
const ai = require('./ai');

// ============ LOCATIONS ============

function createLocation(userId, name, description = null, parentId = null) {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO locations (user_id, name, description, parent_id) VALUES (?, ?, ?, ?)')
    .run(userId, name, description, parentId);

  logActivity(userId, 'create', 'location', result.lastInsertRowid, { name, description });
  return getLocation(userId, result.lastInsertRowid);
}

function getLocation(userId, id) {
  return getDb().prepare('SELECT * FROM locations WHERE id = ? AND user_id = ?').get(id, userId);
}

function getLocationByName(userId, name) {
  return getDb()
    .prepare('SELECT * FROM locations WHERE LOWER(name) = LOWER(?) AND user_id = ?')
    .get(name, userId);
}

function getAllLocations(userId) {
  return getDb()
    .prepare(
      `SELECT l.*, COUNT(DISTINCT c.id) as container_count,
              COUNT(DISTINCT i.id) as item_count
       FROM locations l
       LEFT JOIN containers c ON c.location_id = l.id
       LEFT JOIN items i ON i.location_id = l.id OR i.container_id IN (SELECT id FROM containers WHERE location_id = l.id)
       WHERE l.user_id = ?
       GROUP BY l.id
       ORDER BY l.name`
    )
    .all(userId);
}

function findOrCreateLocation(userId, name, description = null) {
  let location = getLocationByName(userId, name);
  if (!location) {
    location = createLocation(userId, name, description);
  }
  return location;
}

// ============ CONTAINERS ============

function createContainer(userId, data) {
  const db = getDb();
  const { label, type = 'bin', color = null, size = null, description = null, location_id = null } = data;

  const result = db
    .prepare(
      'INSERT INTO containers (user_id, label, type, color, size, description, location_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(userId, label, type, color, size, description, location_id);

  logActivity(userId, 'create', 'container', result.lastInsertRowid, data);
  return getContainer(userId, result.lastInsertRowid);
}

function getContainer(userId, id) {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       WHERE c.id = ? AND c.user_id = ?`
    )
    .get(id, userId);
}

function getContainerByLabel(userId, label) {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       WHERE LOWER(c.label) = LOWER(?) AND c.user_id = ?`
    )
    .get(label, userId);
}

function getAllContainers(userId) {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name, COUNT(i.id) as item_count
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       LEFT JOIN items i ON i.container_id = c.id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.label`
    )
    .all(userId);
}

function getContainersByLocation(userId, locationId) {
  return getDb()
    .prepare(
      `SELECT c.*, COUNT(i.id) as item_count
       FROM containers c
       LEFT JOIN items i ON i.container_id = c.id
       WHERE c.location_id = ? AND c.user_id = ?
       GROUP BY c.id
       ORDER BY c.label`
    )
    .all(locationId, userId);
}

function findOrCreateContainer(userId, data) {
  let container = getContainerByLabel(userId, data.label);
  if (!container) {
    container = createContainer(userId, data);
  }
  return container;
}

// ============ ITEMS ============

async function createItem(userId, data, source = 'app', skipDuplicateCheck = false) {
  const db = getDb();
  const {
    name,
    description = null,
    category = null,
    quantity = 1,
    container_id = null,
    location_id = null,
    tags = [],
    aliases = [],
    notes = null,
  } = data;

  // Check for duplicates unless explicitly skipped
  if (!skipDuplicateCheck) {
    const dupCheck = await ai.checkDuplicate({ name, description, category }, userId);
    if (dupCheck.isDuplicate && dupCheck.confidence > 0.8) {
      return {
        duplicate: true,
        existingItemId: dupCheck.matchedItemId,
        existingItemName: dupCheck.matchedItemName,
        confidence: dupCheck.confidence,
        reason: dupCheck.reason,
      };
    }
  }

  const result = db
    .prepare(
      `INSERT INTO items (user_id, name, description, category, quantity, container_id, location_id, tags, aliases, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      name,
      description,
      category,
      quantity,
      container_id,
      location_id,
      JSON.stringify(tags),
      JSON.stringify(aliases),
      notes
    );

  const itemId = result.lastInsertRowid;
  logActivity(userId, 'create', 'item', itemId, { name, source }, source);

  // Generate and store search index
  try {
    const searchTerms = await ai.generateSearchTerms({ name, description, category, tags, aliases });
    const insertTerm = db.prepare('INSERT INTO search_index (item_id, term, weight) VALUES (?, ?, ?)');
    const insertMany = db.transaction((terms) => {
      for (const t of terms) {
        insertTerm.run(itemId, t.term.toLowerCase(), t.weight);
      }
    });
    insertMany(searchTerms);
  } catch (err) {
    console.error('Failed to generate search terms for item', itemId, err.message);
  }

  return getItem(userId, itemId);
}

// Bulk create items from parsed voice data
function bulkCreateItems(userId, parsedData) {
  const db = getDb();

  const results = { locations: [], containers: [], items: [], errors: [] };

  // Create locations
  for (const loc of parsedData.locations || []) {
    try {
      const location = findOrCreateLocation(userId, loc.name, loc.description);
      results.locations.push(location);
    } catch (err) {
      results.errors.push({ type: 'location', data: loc, error: err.message });
    }
  }

  // Create containers
  for (const cont of parsedData.containers || []) {
    try {
      const location = cont.location ? getLocationByName(userId, cont.location) : null;
      const container = findOrCreateContainer(userId, {
        label: cont.label,
        type: cont.type || 'bin',
        color: cont.color,
        size: cont.size,
        description: cont.description,
        location_id: location ? location.id : null,
      });
      results.containers.push(container);
    } catch (err) {
      results.errors.push({ type: 'container', data: cont, error: err.message });
    }
  }

  // Create items
  const insertItem = db.prepare(
    `INSERT INTO items (user_id, name, description, category, quantity, container_id, location_id, tags, aliases, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSearchTerm = db.prepare('INSERT INTO search_index (item_id, term, weight) VALUES (?, ?, ?)');

  for (const item of parsedData.items || []) {
    try {
      const container = item.container ? getContainerByLabel(userId, item.container) : null;
      const location = item.location ? getLocationByName(userId, item.location) : null;

      const result = insertItem.run(
        userId,
        item.name,
        item.description || null,
        item.category || null,
        item.quantity || 1,
        container ? container.id : null,
        location ? location.id : null,
        JSON.stringify(item.tags || []),
        JSON.stringify(item.aliases || []),
        item.notes || null
      );

      const itemId = result.lastInsertRowid;
      logActivity(userId, 'create', 'item', itemId, { name: item.name, source: 'voice_note' }, 'voice_note');

      // Add basic search terms synchronously
      const terms = new Set();
      item.name.toLowerCase().split(/\s+/).forEach((w) => terms.add(w));
      (item.tags || []).forEach((t) => terms.add(t.toLowerCase()));
      (item.aliases || []).forEach((a) => terms.add(a.toLowerCase()));
      if (item.category) terms.add(item.category.toLowerCase());

      for (const term of terms) {
        if (term.length > 1) {
          insertSearchTerm.run(itemId, term, 1.0);
        }
      }

      results.items.push({ id: itemId, name: item.name });
    } catch (err) {
      results.errors.push({ type: 'item', data: item, error: err.message });
    }
  }

  return results;
}

function getItem(userId, id) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, c.type as container_type,
              l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.id = ? AND i.user_id = ?`
    )
    .get(id, userId);
}

function getAllItems(userId, limit = 100, offset = 0) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, c.type as container_type,
              l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.user_id = ?
       ORDER BY i.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(userId, limit, offset);
}

function getItemsByContainer(userId, containerId) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.container_id = ? AND i.user_id = ?
       ORDER BY i.name`
    )
    .all(containerId, userId);
}

function getItemsByLocation(userId, locationId) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE (i.location_id = ? OR c.location_id = ?) AND i.user_id = ?
       ORDER BY i.name`
    )
    .all(locationId, locationId, userId);
}

function getItemsByCategory(userId, category) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE LOWER(i.category) = LOWER(?) AND i.user_id = ?
       ORDER BY i.name`
    )
    .all(category, userId);
}

function updateItem(userId, id, updates) {
  const db = getDb();
  // Verify ownership
  const item = getItem(userId, id);
  if (!item) return null;

  const allowed = ['name', 'description', 'category', 'quantity', 'container_id', 'location_id', 'tags', 'aliases', 'notes'];
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'tags' || key === 'aliases' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) return item;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id, userId);

  db.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  logActivity(userId, 'update', 'item', id, updates);
  return getItem(userId, id);
}

function moveItem(userId, itemId, toContainerId = null, toLocationId = null) {
  const db = getDb();
  const item = getItem(userId, itemId);
  if (!item) return null;

  db.prepare(
    'UPDATE items SET container_id = ?, location_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
  ).run(
    toContainerId !== null ? toContainerId : item.container_id,
    toLocationId !== null ? toLocationId : item.location_id,
    itemId,
    userId
  );

  logActivity(userId, 'move', 'item', itemId, {
    from_container: item.container_label,
    to_container_id: toContainerId,
    to_location_id: toLocationId,
  });

  return getItem(userId, itemId);
}

function deleteItem(userId, id) {
  const db = getDb();
  const item = getItem(userId, id);
  if (!item) return null;

  db.prepare('DELETE FROM search_index WHERE item_id = ?').run(id);
  db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(id, userId);
  logActivity(userId, 'delete', 'item', id, { name: item.name });
  return item;
}

// Basic text search using the search index
function quickSearch(userId, query) {
  const db = getDb();
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);

  if (terms.length === 0) return [];

  const placeholders = terms.map(() => 'si.term LIKE ?').join(' OR ');
  const params = terms.map((t) => `%${t}%`);

  return db
    .prepare(
      `SELECT DISTINCT i.*, c.label as container_label, c.type as container_type,
              l.name as location_name,
              SUM(si.weight) as search_score
       FROM search_index si
       JOIN items i ON si.item_id = i.id
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE (${placeholders}) AND i.user_id = ?
       GROUP BY i.id
       ORDER BY search_score DESC
       LIMIT 50`
    )
    .all(...params, userId);
}

// ============ ACTIVITY LOG ============

function logActivity(userId, action, entityType, entityId, details = {}, source = 'app') {
  getDb()
    .prepare(
      'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, source) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(userId, action, entityType, entityId, JSON.stringify(details), source);
}

function getRecentActivity(userId, limit = 50) {
  return getDb()
    .prepare('SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit);
}

// ============ STATS ============

function getStats(userId) {
  const db = getDb();
  return {
    totalItems: db.prepare('SELECT COUNT(*) as count FROM items WHERE user_id = ?').get(userId).count,
    totalContainers: db.prepare('SELECT COUNT(*) as count FROM containers WHERE user_id = ?').get(userId).count,
    totalLocations: db.prepare('SELECT COUNT(*) as count FROM locations WHERE user_id = ?').get(userId).count,
    totalVoiceNotes: db.prepare('SELECT COUNT(*) as count FROM voice_notes WHERE user_id = ?').get(userId).count,
    categories: db
      .prepare(
        `SELECT category, COUNT(*) as count FROM items
         WHERE category IS NOT NULL AND user_id = ?
         GROUP BY category ORDER BY count DESC`
      )
      .all(userId),
    recentActivity: getRecentActivity(userId, 10),
  };
}

module.exports = {
  createLocation,
  getLocation,
  getLocationByName,
  getAllLocations,
  findOrCreateLocation,
  createContainer,
  getContainer,
  getContainerByLabel,
  getAllContainers,
  getContainersByLocation,
  findOrCreateContainer,
  createItem,
  bulkCreateItems,
  getItem,
  getAllItems,
  getItemsByContainer,
  getItemsByLocation,
  getItemsByCategory,
  updateItem,
  moveItem,
  deleteItem,
  quickSearch,
  logActivity,
  getRecentActivity,
  getStats,
};
