import { createClient, Client, InValue } from "@libsql/client";

let client: Client | null = null;
let initialized = false;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:blockconstruction.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

async function initializeSchema(db: Client) {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
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
      )`,
      `CREATE TABLE IF NOT EXISTS projects (
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
      )`,
      `CREATE TABLE IF NOT EXISTS blocks (
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
      )`,
      `CREATE TABLE IF NOT EXISTS block_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        depends_on_block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        UNIQUE(block_id, depends_on_block_id)
      )`,
      `CREATE TABLE IF NOT EXISTS bids (
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
      )`,
      `CREATE TABLE IF NOT EXISTS progress_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        trade_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL,
        notes TEXT,
        new_estimated_completion TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_project_id INTEGER REFERENCES projects(id),
        related_block_id INTEGER REFERENCES blocks(id),
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS appreciations (
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
      )`,
    ],
    "write"
  );
}

async function autoSeed(db: Client) {
  const result = await db.execute("SELECT COUNT(*) as count FROM users");
  const count = Number(result.rows[0][0]);
  if (count > 0) return;
  const { seedDatabase } = await import("./seed");
  await seedDatabase(db);
}

export async function ensureDb(): Promise<Client> {
  const db = getClient();
  if (!initialized) {
    await initializeSchema(db);
    await autoSeed(db);
    initialized = true;
  }
  return db;
}

export function getDb(): Client {
  return getClient();
}

// Helper: convert ResultSet rows to plain objects
function rowsToObjects(
  columns: string[],
  rows: Array<Array<InValue>>
): Record<string, unknown>[] {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// Query helpers that return plain objects (safe for JSON serialization)
export async function query(
  sql: string,
  args: InValue[] = []
): Promise<Row[]> {
  const db = await ensureDb();
  const result = await db.execute({ sql, args });
  return rowsToObjects(result.columns, result.rows as unknown as Array<Array<InValue>>);
}

export async function queryOne(
  sql: string,
  args: InValue[] = []
): Promise<Row | undefined> {
  const rows = await query(sql, args);
  return rows[0];
}

export async function execute(sql: string, args: InValue[] = []) {
  const db = await ensureDb();
  return await db.execute({ sql, args });
}
