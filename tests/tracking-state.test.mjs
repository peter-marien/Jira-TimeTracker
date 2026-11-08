import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import * as timeUtils from '../src/lib/time-utils.ts';
import { loadElectronModule } from './load-electron-module.mjs';

function setup(t) {
    const db = new DatabaseSync(':memory:');
    t.after(() => db.close());
    db.exec(`
        CREATE TABLE work_items (id INTEGER PRIMARY KEY, description TEXT, jira_key TEXT);
        CREATE TABLE time_slices (id INTEGER PRIMARY KEY, work_item_id INTEGER, start_time TEXT, end_time TEXT,
                                 synced_to_jira INTEGER DEFAULT 0, updated_at INTEGER);
        CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
        INSERT INTO work_items VALUES (1, 'Investigation', 'TEST-1');
        INSERT INTO time_slices (id, work_item_id, start_time) VALUES (1, 1, '2026-11-08T09:00:00Z');
    `);
    const powerMonitor = new EventEmitter();
    const handlers = new Map();
    const messages = [[], []];
    const windows = messages.map(received => ({
        isDestroyed: () => false,
        webContents: { isDestroyed: () => false, send: (channel, snapshot) => received.push({ channel, snapshot }) }
    }));
    const service = loadElectronModule('electron/tracking-state.ts', {
        electron: { powerMonitor, ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
            BrowserWindow: { getAllWindows: () => windows } },
        '../src/database/db': { getDatabase: () => db },
        '../src/lib/time-utils': timeUtils,
        './tray': { updateTrayIcon() {}, updateTrayTooltip() {} }
    }, { console: { log() {}, error() {} } });
    service.initializeTrackingState();
    return { db, service, handlers, powerMonitor, messages, windows };
}

test('stop is persisted before acknowledgement and both windows stay idle after resume', async t => {
    const { db, handlers, powerMonitor, messages } = setup(t);
    assert.equal(messages[0].at(-1).snapshot.activeSlice.id, 1);
    const end = await handlers.get('tracking:stop')({});
    assert.ok(end);
    assert.equal(db.prepare('SELECT end_time FROM time_slices WHERE id = 1').get().end_time, end);
    for (const received of messages) assert.equal(received.at(-1).snapshot.activeSlice, null);
    powerMonitor.emit('resume');
    powerMonitor.emit('unlock-screen');
    for (const received of messages) {
        assert.equal(received.at(-1).snapshot.activeSlice, null);
        assert.equal(received.at(-1).snapshot.workItem, null);
    }
});

test('failed stop preserves active tracking and does not announce an idle state', async t => {
    const { db, handlers, messages } = setup(t);
    db.exec("CREATE TRIGGER prevent_stop BEFORE UPDATE ON time_slices BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;");
    const count = messages[0].length;
    assert.throws(() => handlers.get('tracking:stop')({}), /simulated write failure/);
    assert.equal(db.prepare('SELECT end_time FROM time_slices WHERE id = 1').get().end_time, null);
    assert.equal(messages[0].length, count);
    assert.equal(messages[0].at(-1).snapshot.activeSlice.id, 1);
});

test('successful mutations publish saved state; rejected mutations publish nothing', async t => {
    const { db, service, handlers, messages } = setup(t);
    service.handleTrackingMutation('test:save', () => {
        db.prepare('UPDATE time_slices SET end_time = ? WHERE id = 1').run('2026-11-08T10:00:00Z');
        return 'saved';
    });
    assert.equal(await handlers.get('test:save')({}), 'saved');
    assert.equal(messages[0].at(-1).snapshot.activeSlice, null);
    const count = messages[0].length;
    service.handleTrackingMutation('test:failed-save', () => { throw new Error('write failed'); });
    await assert.rejects(handlers.get('test:failed-save')({}), /write failed/);
    assert.equal(messages[0].length, count);
});

test('resume reads persisted state instead of trusting an old renderer cache', t => {
    const { db, powerMonitor, messages } = setup(t);
    db.exec("UPDATE time_slices SET end_time = '2026-11-08T10:00:00Z' WHERE id = 1;");
    powerMonitor.emit('resume');
    assert.equal(messages[0].at(-1).snapshot.activeSlice, null);
    assert.ok(messages[0].at(-1).snapshot.revision > messages[0][0].snapshot.revision);
});

test('stop is idempotent and retains the original start and saved end time', async t => {
    const { db, handlers } = setup(t);
    const first = await handlers.get('tracking:stop')({});
    assert.equal(await handlers.get('tracking:stop')({}), null);
    const row = db.prepare('SELECT start_time, end_time FROM time_slices WHERE id = 1').get();
    assert.equal(row.start_time, '2026-11-08T09:00:00Z');
    assert.equal(row.end_time, first);
});

test('a failed renderer notification cannot prevent stopping or notifying healthy windows', async t => {
    const { handlers, messages, windows } = setup(t);
    windows[1].webContents.send = () => { throw new Error('renderer frame disposed'); };
    assert.ok(await handlers.get('tracking:stop')({}));
    assert.equal(messages[0].at(-1).snapshot.activeSlice, null);
});
