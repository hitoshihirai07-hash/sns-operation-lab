CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('threads','x')),
  source TEXT NOT NULL DEFAULT 'app',
  external_id TEXT,
  text TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '未分類',
  status TEXT NOT NULL CHECK (status IN ('draft','scheduled','planned','publishing','published','failed','needs_review','cancelled')),
  scheduled_at TEXT,
  published_at TEXT,
  views INTEGER,
  likes INTEGER,
  replies INTEGER,
  reposts INTEGER,
  quotes INTEGER,
  shares INTEGER,
  engagements INTEGER,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(platform, external_id)
);
CREATE INDEX IF NOT EXISTS idx_posts_status_date ON posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_platform_date ON posts(platform, published_at DESC);
CREATE TABLE IF NOT EXISTS snapshots (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  views INTEGER,
  likes INTEGER,
  replies INTEGER,
  reposts INTEGER,
  quotes INTEGER,
  shares INTEGER,
  engagements INTEGER,
  PRIMARY KEY (post_id, captured_at)
);
CREATE TABLE IF NOT EXISTS x_daily (
  day TEXT PRIMARY KEY,
  impressions INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  engagements INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  bookmarks INTEGER NOT NULL DEFAULT 0,
  profile_visits INTEGER NOT NULL DEFAULT 0,
  follows INTEGER NOT NULL DEFAULT 0,
  unfollows INTEGER NOT NULL DEFAULT 0,
  posts INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
