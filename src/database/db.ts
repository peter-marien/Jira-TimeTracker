import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

import { getAppConfig } from '../../electron/config-service';

// This file should ONLY be imported by the Main process

let db: Database.Database | null = null;

export function initializeDatabase(customPath?: string): Database.Database {
  if (db) return db;

  const config = getAppConfig();
  const dbPath = customPath || config.databasePath;

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema
  initSchema(db);

  return db;
}

function initSchema(database: Database.Database) {
  // const schemaPath = path.resolve(__dirname, '../../src/database/schema.sql');
  // Note: logic to read schema file might need adjustment depending on build (bundled vs file)
  // For simplicity, we define schema in code or read from bundled asset
  // Since we are creating this file in src/database, let's embed schema here or read it.

  // Actually, reading from file in bundled app is tricky. 
  // Better to use a string constant or imports. 
  // But for now, let's assume we read the SQL file if possible, or copy content.
  // I will embed the schema content here for reliability in Electron production builds.

  const schema = `
    CREATE TABLE IF NOT EXISTS jira_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      email TEXT NOT NULL,
      api_token TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS work_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jira_connection_id INTEGER,
      jira_key TEXT,
      description TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (jira_connection_id) REFERENCES jira_connections(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS time_slices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_item_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      notes TEXT,
      synced_to_jira INTEGER DEFAULT 0,
      jira_worklog_id TEXT,
      synced_start_time TEXT,
      synced_end_time TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `;

  database.exec(schema);

  // Run migrations for existing databases
  runMigrations(database);
}

function runMigrations(database: Database.Database) {
  // Migration: Add synced_start_time and synced_end_time columns if they don't exist
  try {
    // Check if columns exist by trying to select them
    database.prepare('SELECT synced_start_time FROM time_slices LIMIT 1').get();
  } catch (error) {
    // Columns don't exist, add them
    console.log('Running migration: Adding synced_start_time and synced_end_time columns');
    database.exec(`
      ALTER TABLE time_slices ADD COLUMN synced_start_time TEXT;
      ALTER TABLE time_slices ADD COLUMN synced_end_time TEXT;
    `);
    console.log('Migration completed successfully');
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
