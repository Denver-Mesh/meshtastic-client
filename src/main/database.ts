import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

let db: Database.Database | null = null;

export function initDatabase(): void {
  const dbPath = path.join(app.getPath("userData"), "electastic.db");
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      sender_name TEXT,
      payload TEXT NOT NULL,
      channel INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      node_id INTEGER PRIMARY KEY,
      long_name TEXT,
      short_name TEXT,
      hw_model TEXT,
      snr REAL,
      battery INTEGER,
      last_heard INTEGER,
      latitude REAL,
      longitude REAL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_nodes_last_heard ON nodes(last_heard);
  `);

  // ─── Schema migrations ────────────────────────────────────────────
  const userVersion = db.pragma("user_version", { simple: true }) as number;

  if (userVersion < 1) {
    db.exec(`
      ALTER TABLE messages ADD COLUMN packet_id INTEGER;
      ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'acked';
      ALTER TABLE messages ADD COLUMN error TEXT;
    `);
    db.pragma("user_version = 1");
  }

  if (userVersion < 2) {
    db.exec(`
      ALTER TABLE messages ADD COLUMN emoji INTEGER;
      ALTER TABLE messages ADD COLUMN reply_id INTEGER;
    `);
    db.pragma("user_version = 2");
  }

  if (userVersion < 3) {
    db.exec(`ALTER TABLE messages ADD COLUMN to_node INTEGER;`);
    db.pragma("user_version = 3");
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export function getDatabasePath(): string {
  return path.join(app.getPath("userData"), "electastic.db");
}

export function exportDatabase(destPath: string): void {
  const database = getDatabase();
  database.backup(destPath);
}

export function mergeDatabase(
  sourcePath: string
): { nodesAdded: number; messagesAdded: number } {
  const database = getDatabase();
  const sourceDb = new Database(sourcePath, { readonly: true });

  const nodesBefore = (
    database.prepare("SELECT COUNT(*) as c FROM nodes").get() as {
      c: number;
    }
  ).c;
  const msgsBefore = (
    database.prepare("SELECT COUNT(*) as c FROM messages").get() as {
      c: number;
    }
  ).c;

  // Merge nodes (dedup by node_id primary key)
  const sourceNodes = sourceDb.prepare("SELECT * FROM nodes").all();
  const insertNode = database.prepare(`
    INSERT OR IGNORE INTO nodes (node_id, long_name, short_name, hw_model, snr, battery, last_heard, latitude, longitude)
    VALUES (@node_id, @long_name, @short_name, @hw_model, @snr, @battery, @last_heard, @latitude, @longitude)
  `);
  const mergeNodesTransaction = database.transaction(() => {
    for (const node of sourceNodes) {
      insertNode.run(node);
    }
  });
  mergeNodesTransaction();

  // Merge messages (dedup by sender_id + timestamp + payload)
  const sourceMessages = sourceDb.prepare("SELECT * FROM messages").all();
  const insertMsg = database.prepare(`
    INSERT INTO messages (sender_id, sender_name, payload, channel, timestamp)
    SELECT @sender_id, @sender_name, @payload, @channel, @timestamp
    WHERE NOT EXISTS (
      SELECT 1 FROM messages
      WHERE sender_id = @sender_id AND timestamp = @timestamp AND payload = @payload
    )
  `);
  const mergeMsgsTransaction = database.transaction(() => {
    for (const msg of sourceMessages) {
      insertMsg.run(msg);
    }
  });
  mergeMsgsTransaction();

  sourceDb.close();

  const nodesAfter = (
    database.prepare("SELECT COUNT(*) as c FROM nodes").get() as {
      c: number;
    }
  ).c;
  const msgsAfter = (
    database.prepare("SELECT COUNT(*) as c FROM messages").get() as {
      c: number;
    }
  ).c;

  return {
    nodesAdded: nodesAfter - nodesBefore,
    messagesAdded: msgsAfter - msgsBefore,
  };
}
