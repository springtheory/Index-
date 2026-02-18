const { getDb } = require('../db');
const ai = require('./ai');

// ============ LOCATIONS ============

function createLocation(name, description = null, parentId = null) {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO locations (name, description, parent_id) VALUES (?, ?, ?)')
    .run(name, description, parentId);

  logActivity('create', 'location', result.lastInsertRowid, { name, description });
  return getLocation(result.lastInsertRowid);
}

function getLocation(id) {
  return getDb().prepare('SELECT * FROM locations WHERE id = ?').get(id);
}

function getLocationByName(name) {
  return getDb()
    .prepare('SELECT * FROM locations WHERE LOWER(name) = LOWER(?)')
    .get(name);
}

function getAllLocations() {
  return getDb()
    .prepare(
      `SELECT l.*, COUNT(DISTINCT c.id) as container_count,
              COUNT(DISTINCT i.id) as item_count
       FROM locations l
       LEFT JOIN containers c ON c.location_id = l.id
       LEFT JOIN items i ON i.location_id = l.id OR i.container_id IN (SELECT id FROM containers WHERE location_id = l.id)
       GROUP BY l.id
       ORDER BY l.name`
    )
    .all();
}

function findOrCreateLocation(name, description = null) {
  let location = getLocationByName(name);
  if (!location) {
    location = createLocation(name, description);
  }
  return location;
}

// ============ CONTAINERS ============

function createContainer(data) {
  const db = getDb();
  const { label, type = 'bin', color = null, size = null, description = null, location_id = null } = data;

  const result = db
    .prepare(
      'INSERT INTO containers (label, type, color, size, description, location_id) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(label, type, color, size, description, location_id);

  logActivity('create', 'container', result.lastInsertRowid, data);
  return getContainer(result.lastInsertRowid);
}

function getContainer(id) {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       WHERE c.id = ?`
    )
    .get(id);
}

function getContainerByLabel(label) {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       WHERE LOWER(c.label) = LOWER(?)`
    )
    .get(label);
}

function getAllContainers() {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name, COUNT(i.id) as item_count
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       LEFT JOIN items i ON i.container_id = c.id
       GROUP BY c.id
       ORDER BY c.label`
    )
    .all();
}

function getContainersByLocation(locationId) {
  return getDb()
    .prepare(
      `SELECT c.*, COUNT(i.id) as item_count
       FROM containers c
       LEFT JOIN items i ON i.container_id = c.id
       WHERE c.location_id = ?
       GROUP BY c.id
       ORDER BY c.label`
    )
    .all(locationId);
}

function findOrCreateContainer(data) {
  let container = getContainerByLabel(data.label);
  if (!container) {
    container = createContainer(data);
  }
  return container;
}

// ============ ITEMS ============

async function createItem(data, source = 'app', skipDuplicateCheck = false) {
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
    const dupCheck = await ai.checkDuplicate({ name, description, category });
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
      `INSERT INTO items (name, description, category, quantity, container_id, location_id, tags, aliases, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
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
  logActivity('create', 'item', itemId, { name, source }, source);

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

  return getItem(itemId);
}

// Bulk create items from parsed voice data (skips individual duplicate AI calls for speed)
function bulkCreateItems(parsedData) {
  const db = getDb();

  const results = { locations: [], containers: [], items: [], errors: [] };

  // Create locations
  for (const loc of parsedData.locations || []) {
    try {
      const location = findOrCreateLocation(loc.name, loc.description);
      results.locations.push(location);
    } catch (err) {
      results.errors.push({ type: 'location', data: loc, error: err.message });
    }
  }

  // Create containers
  for (const cont of parsedData.containers || []) {
    try {
      const location = cont.location ? getLocationByName(cont.location) : null;
      const container = findOrCreateContainer({
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
    `INSERT INTO items (name, description, category, quantity, container_id, location_id, tags, aliases, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSearchTerm = db.prepare('INSERT INTO search_index (item_id, term, weight) VALUES (?, ?, ?)');

  for (const item of parsedData.items || []) {
    try {
      const container = item.container ? getContainerByLabel(item.container) : null;
      const location = item.location ? getLocationByName(item.location) : null;

      const result = insertItem.run(
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
      logActivity('create', 'item', itemId, { name: item.name, source: 'voice_note' }, 'voice_note');

      // Add basic search terms synchronously (name words + tags + aliases)
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

function getItem(id) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, c.type as container_type,
              l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.id = ?`
    )
    .get(id);
}

function getAllItems(limit = 100, offset = 0) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, c.type as container_type,
              l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       ORDER BY i.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
}

function getItemsByContainer(containerId) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.container_id = ?
       ORDER BY i.name`
    )
    .all(containerId);
}

function getItemsByLocation(locationId) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.location_id = ? OR c.location_id = ?
       ORDER BY i.name`
    )
    .all(locationId, locationId);
}

function getItemsByCategory(category) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE LOWER(i.category) = LOWER(?)
       ORDER BY i.name`
    )
    .all(category);
}

function updateItem(id, updates) {
  const db = getDb();
  const allowed = ['name', 'description', 'category', 'quantity', 'container_id', 'location_id', 'tags', 'aliases', 'notes'];
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'tags' || key === 'aliases' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) return getItem(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  logActivity('update', 'item', id, updates);
  return getItem(id);
}

function moveItem(itemId, toContainerId = null, toLocationId = null) {
  const db = getDb();
  const item = getItem(itemId);
  if (!item) return null;

  const updates = {};
  if (toContainerId !== null) updates.container_id = toContainerId;
  if (toLocationId !== null) updates.location_id = toLocationId;

  db.prepare(
    'UPDATE items SET container_id = ?, location_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(
    toContainerId !== null ? toContainerId : item.container_id,
    toLocationId !== null ? toLocationId : item.location_id,
    itemId
  );

  logActivity('move', 'item', itemId, {
    from_container: item.container_label,
    to_container_id: toContainerId,
    to_location_id: toLocationId,
  });

  return getItem(itemId);
}

function deleteItem(id) {
  const db = getDb();
  const item = getItem(id);
  if (!item) return null;

  db.prepare('DELETE FROM search_index WHERE item_id = ?').run(id);
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  logActivity('delete', 'item', id, { name: item.name });
  return item;
}

// Basic text search using the search index
function quickSearch(query) {
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
       WHERE ${placeholders}
       GROUP BY i.id
       ORDER BY search_score DESC
       LIMIT 50`
    )
    .all(...params);
}

// ============ ACTIVITY LOG ============

function logActivity(action, entityType, entityId, details = {}, source = 'app') {
  getDb()
    .prepare(
      'INSERT INTO activity_log (action, entity_type, entity_id, details, source) VALUES (?, ?, ?, ?, ?)'
    )
    .run(action, entityType, entityId, JSON.stringify(details), source);
}

function getRecentActivity(limit = 50) {
  return getDb()
    .prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?')
    .all(limit);
}

// ============ STATS ============

function getStats() {
  const db = getDb();
  return {
    totalItems: db.prepare('SELECT COUNT(*) as count FROM items').get().count,
    totalContainers: db.prepare('SELECT COUNT(*) as count FROM containers').get().count,
    totalLocations: db.prepare('SELECT COUNT(*) as count FROM locations').get().count,
    totalVoiceNotes: db.prepare('SELECT COUNT(*) as count FROM voice_notes').get().count,
    categories: db
      .prepare(
        `SELECT category, COUNT(*) as count FROM items
         WHERE category IS NOT NULL
         GROUP BY category ORDER BY count DESC`
      )
      .all(),
    recentActivity: getRecentActivity(10),
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
