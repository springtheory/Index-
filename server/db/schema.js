const CREATE_TABLES = `
  -- Users: authentication
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    pin_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  -- Sessions: track active JWT tokens for revocation
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  -- Locations: rooms, areas, zones in the house/garage
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES locations(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Containers: bins, boxes, shelves, drawers, bags
  CREATE TABLE IF NOT EXISTS containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
  CREATE INDEX IF NOT EXISTS idx_items_container ON items(container_id);
  CREATE INDEX IF NOT EXISTS idx_items_location ON items(location_id);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_containers_user ON containers(user_id);
  CREATE INDEX IF NOT EXISTS idx_containers_location ON containers(location_id);
  CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id);
  CREATE INDEX IF NOT EXISTS idx_voice_notes_user ON voice_notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_search_index_term ON search_index(term);
  CREATE INDEX IF NOT EXISTS idx_search_index_item ON search_index(item_id);
  CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_voice_notes_status ON voice_notes(status);
`;

module.exports = { CREATE_TABLES };
