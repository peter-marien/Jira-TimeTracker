import assert from 'node:assert/strict';
import fs from 'node:fs';
import DefaultDatabase from 'better-sqlite3';
import { loadElectronModule } from './load-electron-module.mjs';

// Both module loads use an explicit disposable path and a mocked config service.
// Importing the real config service could resolve the user's live database.
export function verifyDatabaseCompatibility(databasePath, Database = DefaultDatabase) {
    const existing = fs.existsSync(databasePath);
    const load = () => loadElectronModule('src/database/db.ts', {
        'better-sqlite3': Database,
        '../../electron/config-service': { getAppConfig: () => ({ databasePath }) }
    });
    const original = load().initializeDatabase(databasePath);
    try {
        if (!existing) {
            original.prepare(`INSERT INTO jira_connections (id, name, base_url, email, api_token)
                VALUES (1, 'Fixture', 'https://jira.invalid', 'fixture@example.invalid', 'fixture')`).run();
            original.prepare(`INSERT INTO work_items (id, jira_connection_id, jira_key, description)
                VALUES (1, 1, 'TEST-1', 'Existing work item')`).run();
            original.prepare(`INSERT INTO time_slices (id, work_item_id, start_time, end_time, notes)
                VALUES (1, 1, '2026-01-01T08:00:00Z', '2026-01-01T09:00:00Z', 'Preserve me')`).run();
            original.prepare(`INSERT INTO time_slices (id, work_item_id, start_time, end_time, notes)
                VALUES (2, 1, '2026-01-01T10:00:00Z', NULL, 'Active entry')`).run();
            original.prepare(`INSERT INTO tags (id, name) VALUES (1, 'Existing tag')`).run();
            original.prepare(`INSERT INTO time_slice_tags VALUES (1, 1)`).run();
            original.prepare(`INSERT INTO settings (key, value) VALUES ('fixture', 'saved setting')`).run();
        }
    } finally {
        original.close();
    }

    const readSnapshot = db => ({
        rows: Object.fromEntries(
            ['jira_connections', 'work_items', 'time_slices', 'tags', 'time_slice_tags', 'settings']
                .map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])
        ),
        schema: db.prepare(`SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name`).all()
    });
    const before = new Database(databasePath, { readonly: true });
    let expected;
    try {
        expected = readSnapshot(before);
    } finally {
        before.close();
    }

    const reopened = load().initializeDatabase(databasePath);
    try {
        assert.deepEqual(readSnapshot(reopened), expected);
        assert.equal(reopened.pragma('integrity_check', { simple: true }), 'ok');
        assert.deepEqual(reopened.pragma('foreign_key_check'), []);
        assert.equal(reopened.pragma('journal_mode', { simple: true }), 'wal');
        assert.throws(() => reopened.transaction(() => {
            reopened.prepare(`UPDATE time_slices SET notes = 'Rolled back' WHERE id = 1`).run();
            throw new Error('Simulated failed write');
        })(), /Simulated failed write/);
        assert.deepEqual(readSnapshot(reopened), expected);
    } finally {
        reopened.close();
    }
    return expected;
}
