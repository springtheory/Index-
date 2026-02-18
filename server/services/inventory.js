const { getDb } = require('../db');
const ai = require('./ai');

// ============ LOCATIONS ============

function createLocation(householdId, name, description = null, parentId = null) {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO locations (household_id, name, description, parent_id) VALUES (?, ?, ?, ?)')
    .run(householdId, name, description, parentId);

  logActivity(householdId, null, 'create', 'location', result.lastInsertRowid, { name, description });
  return getLocation(householdId, result.lastInsertRowid);
}

function getLocation(householdId, id) {
  return getDb().prepare('SELECT * FROM locations WHERE id = ? AND household_id = ?').get(id, householdId);
}

function getLocationByName(householdId, name) {
  return getDb()
    .prepare('SELECT * FROM locations WHERE LOWER(name) = LOWER(?) AND household_id = ?')
    .get(name, householdId);
}

function getAllLocations(householdId) {
  return getDb()
    .prepare(
      `SELECT l.*, COUNT(DISTINCT c.id) as container_count,
              COUNT(DISTINCT i.id) as item_count
       FROM locations l
       LEFT JOIN containers c ON c.location_id = l.id
       LEFT JOIN items i ON i.location_id = l.id OR i.container_id IN (SELECT id FROM containers WHERE location_id = l.id)
       WHERE l.household_id = ?
       GROUP BY l.id
       ORDER BY l.name`
    )
    .all(householdId);
}

function findOrCreateLocation(householdId, name, description = null) {
  let location = getLocationByName(householdId, name);
  if (!location) {
    location = createLocation(householdId, name, description);
  }
  return location;
}

// ============ CONTAINERS ============

function createContainer(householdId, data) {
  const db = getDb();
  const { label, type = 'bin', color = null, size = null, description = null, location_id = null } = data;

  const result = db
    .prepare(
      'INSERT INTO containers (household_id, label, type, color, size, description, location_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(householdId, label, type, color, size, description, location_id);

  logActivity(householdId, null, 'create', 'container', result.lastInsertRowid, data);
  return getContainer(householdId, result.lastInsertRowid);
}

function getContainer(householdId, id) {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       WHERE c.id = ? AND c.household_id = ?`
    )
    .get(id, householdId);
}

function getContainerByLabel(householdId, label) {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       WHERE LOWER(c.label) = LOWER(?) AND c.household_id = ?`
    )
    .get(label, householdId);
}

function getAllContainers(householdId) {
  return getDb()
    .prepare(
      `SELECT c.*, l.name as location_name, COUNT(i.id) as item_count
       FROM containers c
       LEFT JOIN locations l ON c.location_id = l.id
       LEFT JOIN items i ON i.container_id = c.id
       WHERE c.household_id = ?
       GROUP BY c.id
       ORDER BY c.label`
    )
    .all(householdId);
}

function getContainersByLocation(householdId, locationId) {
  return getDb()
    .prepare(
      `SELECT c.*, COUNT(i.id) as item_count
       FROM containers c
       LEFT JOIN items i ON i.container_id = c.id
       WHERE c.location_id = ? AND c.household_id = ?
       GROUP BY c.id
       ORDER BY c.label`
    )
    .all(locationId, householdId);
}

function findOrCreateContainer(householdId, data) {
  let container = getContainerByLabel(householdId, data.label);
  if (!container) {
    container = createContainer(householdId, data);
  }
  return container;
}

// ============ ITEMS ============

async function createItem(householdId, userId, data, source = 'app', skipDuplicateCheck = false) {
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
    const dupCheck = await ai.checkDuplicate({ name, description, category }, householdId);
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
      `INSERT INTO items (household_id, name, description, category, quantity, container_id, location_id, tags, aliases, notes, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      householdId,
      name,
      description,
      category,
      quantity,
      container_id,
      location_id,
      JSON.stringify(tags),
      JSON.stringify(aliases),
      notes,
      userId
    );

  const itemId = result.lastInsertRowid;
  logActivity(householdId, userId, 'create', 'item', itemId, { name, source }, source);

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

  return getItem(householdId, itemId);
}

// Bulk create items from parsed voice data
function bulkCreateItems(householdId, userId, parsedData) {
  const db = getDb();

  const results = { locations: [], containers: [], items: [], errors: [] };

  // Create locations
  for (const loc of parsedData.locations || []) {
    try {
      const location = findOrCreateLocation(householdId, loc.name, loc.description);
      results.locations.push(location);
    } catch (err) {
      results.errors.push({ type: 'location', data: loc, error: err.message });
    }
  }

  // Create containers
  for (const cont of parsedData.containers || []) {
    try {
      const location = cont.location ? getLocationByName(householdId, cont.location) : null;
      const container = findOrCreateContainer(householdId, {
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
    `INSERT INTO items (household_id, name, description, category, quantity, container_id, location_id, tags, aliases, notes, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSearchTerm = db.prepare('INSERT INTO search_index (item_id, term, weight) VALUES (?, ?, ?)');

  for (const item of parsedData.items || []) {
    try {
      const container = item.container ? getContainerByLabel(householdId, item.container) : null;
      const location = item.location ? getLocationByName(householdId, item.location) : null;

      const result = insertItem.run(
        householdId,
        item.name,
        item.description || null,
        item.category || null,
        item.quantity || 1,
        container ? container.id : null,
        location ? location.id : null,
        JSON.stringify(item.tags || []),
        JSON.stringify(item.aliases || []),
        item.notes || null,
        userId
      );

      const itemId = result.lastInsertRowid;
      logActivity(householdId, userId, 'create', 'item', itemId, { name: item.name, source: 'voice_note' }, 'voice_note');

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

function getItem(householdId, id) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, c.type as container_type,
              l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.id = ? AND i.household_id = ?`
    )
    .get(id, householdId);
}

function getAllItems(householdId, limit = 100, offset = 0) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, c.type as container_type,
              l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.household_id = ?
       ORDER BY i.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(householdId, limit, offset);
}

function getItemsByContainer(householdId, containerId) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE i.container_id = ? AND i.household_id = ?
       ORDER BY i.name`
    )
    .all(containerId, householdId);
}

function getItemsByLocation(householdId, locationId) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE (i.location_id = ? OR c.location_id = ?) AND i.household_id = ?
       ORDER BY i.name`
    )
    .all(locationId, locationId, householdId);
}

function getItemsByCategory(householdId, category) {
  return getDb()
    .prepare(
      `SELECT i.*, c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id
       WHERE LOWER(i.category) = LOWER(?) AND i.household_id = ?
       ORDER BY i.name`
    )
    .all(category, householdId);
}

function updateItem(householdId, id, updates) {
  const db = getDb();
  // Verify ownership
  const item = getItem(householdId, id);
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
  values.push(id, householdId);

  db.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ? AND household_id = ?`).run(...values);
  logActivity(householdId, null, 'update', 'item', id, updates);
  return getItem(householdId, id);
}

function moveItem(householdId, itemId, toContainerId = null, toLocationId = null) {
  const db = getDb();
  const item = getItem(householdId, itemId);
  if (!item) return null;

  db.prepare(
    'UPDATE items SET container_id = ?, location_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?'
  ).run(
    toContainerId !== null ? toContainerId : item.container_id,
    toLocationId !== null ? toLocationId : item.location_id,
    itemId,
    householdId
  );

  logActivity(householdId, null, 'move', 'item', itemId, {
    from_container: item.container_label,
    to_container_id: toContainerId,
    to_location_id: toLocationId,
  });

  return getItem(householdId, itemId);
}

function deleteItem(householdId, id) {
  const db = getDb();
  const item = getItem(householdId, id);
  if (!item) return null;

  db.prepare('DELETE FROM search_index WHERE item_id = ?').run(id);
  db.prepare('DELETE FROM items WHERE id = ? AND household_id = ?').run(id, householdId);
  logActivity(householdId, null, 'delete', 'item', id, { name: item.name });
  return item;
}

// Basic text search using the search index
function quickSearch(householdId, query) {
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
       WHERE (${placeholders}) AND i.household_id = ?
       GROUP BY i.id
       ORDER BY search_score DESC
       LIMIT 50`
    )
    .all(...params, householdId);
}

// ============ ACTIVITY LOG ============

function logActivity(householdId, userId, action, entityType, entityId, details = {}, source = 'app') {
  getDb()
    .prepare(
      'INSERT INTO activity_log (household_id, user_id, action, entity_type, entity_id, details, source) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(householdId, userId, action, entityType, entityId, JSON.stringify(details), source);
}

function getRecentActivity(householdId, limit = 50) {
  return getDb()
    .prepare('SELECT * FROM activity_log WHERE household_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(householdId, limit);
}

// ============ STATS ============

function getStats(householdId) {
  const db = getDb();
  return {
    totalItems: db.prepare('SELECT COUNT(*) as count FROM items WHERE household_id = ?').get(householdId).count,
    totalContainers: db.prepare('SELECT COUNT(*) as count FROM containers WHERE household_id = ?').get(householdId).count,
    totalLocations: db.prepare('SELECT COUNT(*) as count FROM locations WHERE household_id = ?').get(householdId).count,
    totalVoiceNotes: db.prepare('SELECT COUNT(*) as count FROM voice_notes WHERE household_id = ?').get(householdId).count,
    categories: db
      .prepare(
        `SELECT category, COUNT(*) as count FROM items
         WHERE category IS NOT NULL AND household_id = ?
         GROUP BY category ORDER BY count DESC`
      )
      .all(householdId),
    recentActivity: getRecentActivity(householdId, 10),
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
