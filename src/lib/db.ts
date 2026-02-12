import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "blockconstruction.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeSchema(db);
    autoSeed(db);
  }
  return db;
}

function autoSeed(db: Database.Database) {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count > 0) return;
  // Lazy require to break circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { seedDatabase } = require("./seed");
  seedDatabase();
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('project_owner', 'trade')),
      trade_type TEXT,
      license_info TEXT,
      insurance_info TEXT,
      rating REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      address TEXT NOT NULL,
      project_type TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planning' CHECK(status IN ('planning', 'bidding', 'in_progress', 'completed')),
      budget REAL,
      allow_parallel_bidding INTEGER DEFAULT 0,
      share_token TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      trade_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'open_for_bids', 'awarded', 'in_progress', 'completed', 'delayed')),
      desired_completion_date TEXT,
      estimated_completion_date TEXT,
      actual_completion_date TEXT,
      special_requirements TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS block_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      depends_on_block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      UNIQUE(block_id, depends_on_block_id)
    );

    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      trade_id INTEGER NOT NULL REFERENCES users(id),
      price REAL NOT NULL,
      start_date TEXT,
      duration_days INTEGER,
      description TEXT,
      license_info TEXT,
      insurance_info TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'revised', 'needs_confirmation')),
      is_revision INTEGER DEFAULT 0,
      original_bid_id INTEGER REFERENCES bids(id),
      revision_reason TEXT,
      delay_confirmed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS progress_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      trade_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      notes TEXT,
      new_estimated_completion TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_project_id INTEGER REFERENCES projects(id),
      related_block_id INTEGER REFERENCES blocks(id),
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appreciations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id),
      to_user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER REFERENCES projects(id),
      block_id INTEGER REFERENCES blocks(id),
      type TEXT NOT NULL CHECK(type IN ('coffee', 'lunch', 'dinner', 'custom')),
      amount REAL NOT NULL,
      message TEXT,
      redeem_code TEXT NOT NULL,
      redeemed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
