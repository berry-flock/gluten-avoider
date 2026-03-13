CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  suburb TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  website_url TEXT DEFAULT '',
  google_maps_url TEXT DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('trusted', 'want_to_try', 'avoid')),
  gf_confidence TEXT NOT NULL CHECK (gf_confidence IN ('strong', 'partial', 'uncertain', 'unknown')),
  notes_public TEXT DEFAULT '',
  notes_private TEXT DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('meal', 'style', 'dietary', 'logistics', 'vibe')),
  tag_group TEXT NOT NULL DEFAULT 'category' CHECK (tag_group IN ('category', 'menu_items', 'gluten_features')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS place_tags (
  place_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (place_id, tag_id),
  FOREIGN KEY (place_id) REFERENCES places (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opening_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TEXT DEFAULT '',
  close_time TEXT DEFAULT '',
  is_closed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (place_id) REFERENCES places (id) ON DELETE CASCADE,
  UNIQUE (place_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_places_slug ON places (slug);
CREATE INDEX IF NOT EXISTS idx_places_status ON places (status);
CREATE INDEX IF NOT EXISTS idx_places_confidence ON places (gf_confidence);
CREATE INDEX IF NOT EXISTS idx_places_public ON places (is_public);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags (slug);
CREATE INDEX IF NOT EXISTS idx_place_tags_tag_id ON place_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_opening_hours_place_day ON opening_hours (place_id, day_of_week);
