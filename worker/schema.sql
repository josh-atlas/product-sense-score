CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT,
  quiz TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT,
  initiative TEXT,
  answers TEXT,
  w1 TEXT, w1_score INTEGER, w1_reason TEXT,
  w2 TEXT, w2_score INTEGER, w2_reason TEXT,
  total INTEGER, band TEXT, weakest TEXT, sub TEXT,
  source TEXT, version TEXT, scored_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions (created_at);
