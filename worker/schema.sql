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

-- Added Oct 16, 2026: rate limit and per-email reuse (run once in the D1 console; both statements are safe to re-run).
CREATE TABLE IF NOT EXISTS ip_hits (
  ip_hash TEXT NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ip_hits ON ip_hits (ip_hash, ts);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions (quiz, email, created_at);

-- Added Nov 8, 2026: paid seats from Stripe Checkout (webhook /api/stripe-webhook; read by /api/seats). Safe to re-run.
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT,
  product TEXT NOT NULL,
  session_id TEXT UNIQUE,
  payment_intent TEXT,
  email TEXT,
  name TEXT,
  amount INTEGER,
  currency TEXT,
  status TEXT,
  reference TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases (product, status);
