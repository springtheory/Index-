const CREATE_TABLES = `
  -- Locations: rooms, areas, zones in the house/garage
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES locations(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Containers: bins, boxes, shelves, drawers, bags
  CREATE TABLE IF NOT EXISTS containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    type TEXT DEFAULT 'bin',
    color TEXT,
    size TEXT,
    description TEXT,
    location_id INTEGER REFERENCES locations(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Items: everything stored
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    quantity INTEGER DEFAULT 1,
    container_id INTEGER REFERENCES containers(id),
    location_id INTEGER REFERENCES locations(id),
    tags TEXT DEFAULT '[]',
    aliases TEXT DEFAULT '[]',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Voice notes uploaded
  CREATE TABLE IF NOT EXISTS voice_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT,
    duration_seconds INTEGER,
    file_size INTEGER,
    status TEXT DEFAULT 'pending',
    transcript TEXT,
    parsed_data TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
  );

  -- Activity log for all changes
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    source TEXT DEFAULT 'app',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Search index: stores AI-generated search terms for each item
  CREATE TABLE IF NOT EXISTS search_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    weight REAL DEFAULT 1.0
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_items_container ON items(container_id);
  CREATE INDEX IF NOT EXISTS idx_items_location ON items(location_id);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_containers_location ON containers(location_id);
  CREATE INDEX IF NOT EXISTS idx_search_index_term ON search_index(term);
  CREATE INDEX IF NOT EXISTS idx_search_index_item ON search_index(item_id);
  CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_voice_notes_status ON voice_notes(status);
`;

module.exports = { CREATE_TABLES };
