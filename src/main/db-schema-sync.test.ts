// @vitest-environment node
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { NodeSqliteDB } from './db-compat';
import { CURRENT_SCHEMA_VERSION, runSchemaUpgrade } from './db-schema-sync';

describe('runSchemaUpgrade', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('brings a new database to CURRENT_SCHEMA_VERSION with retention defaults', () => {
    dir = mkdtempSync(join(tmpdir(), 'mesh-schema-test-'));
    const dbPath = join(dir, 'test.db');
    const db = new NodeSqliteDB(dbPath);
    db.pragma('journal_mode = WAL');
    runSchemaUpgrade(db);
    expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_SCHEMA_VERSION);
    const rows = db.prepare('SELECT key FROM app_settings ORDER BY key').all() as { key: string }[];
    expect(rows.map((r) => r.key)).toEqual([
      'meshcoreMessageRetentionCount',
      'meshcoreMessageRetentionEnabled',
      'meshtasticMessageRetentionCount',
      'meshtasticMessageRetentionEnabled',
    ]);
    db.close();
  });

  it('upgrades a legacy minimal schema and stamps CURRENT_SCHEMA_VERSION', () => {
    dir = mkdtempSync(join(tmpdir(), 'mesh-schema-test-'));
    const dbPath = join(dir, 'legacy.db');
    const db = new NodeSqliteDB(dbPath);
    db.execScript('CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT);');
    db.pragma('user_version = 3');
    runSchemaUpgrade(db);
    expect(db.pragma('user_version', { simple: true })).toBe(CURRENT_SCHEMA_VERSION);
    const mcCols = db.prepare('PRAGMA table_info(meshcore_contacts)').all() as { name: string }[];
    expect(mcCols.some((c) => c.name === 'public_key')).toBe(true);
    db.close();
  });

  it('deduplicates reaction rows so idx_reaction_dedup can be created (duplicate triples)', () => {
    dir = mkdtempSync(join(tmpdir(), 'mesh-schema-test-'));
    const dbPath = join(dir, 'reaction-dedup.db');
    const db = new NodeSqliteDB(dbPath);
    runSchemaUpgrade(db);
    db.execScript('DROP INDEX IF EXISTS idx_reaction_dedup');
    db.prepare(
      `INSERT INTO messages (sender_id, sender_name, payload, channel, timestamp, reply_id, emoji)
       VALUES (1, 'a', 'x', 0, 100, 5, 10)`,
    ).run();
    db.prepare(
      `INSERT INTO messages (sender_id, sender_name, payload, channel, timestamp, reply_id, emoji)
       VALUES (1, 'a', 'x2', 0, 101, 5, 10)`,
    ).run();
    runSchemaUpgrade(db);
    const n = (
      db.prepare('SELECT COUNT(*) as c FROM messages WHERE reply_id = 5 AND emoji = 10').get() as {
        c: number;
      }
    ).c;
    expect(n).toBe(1);
    expect(
      db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_reaction_dedup' LIMIT 1`,
        )
        .get(),
    ).toBeDefined();
    db.close();
  });
});
