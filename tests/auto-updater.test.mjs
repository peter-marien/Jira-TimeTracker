import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadElectronModule } from './load-electron-module.mjs';

test('background network failures are caught, retried with a limit, and delayed after resume', async () => {
    const updater = new EventEmitter();
    let calls = 0;
    updater.checkForUpdatesAndNotify = async () => { calls++; throw new Error('net::ERR_NETWORK_IO_SUSPENDED'); };
    const app = new EventEmitter();
    const powerMonitor = new EventEmitter();
    const timers = new Map();
    const log = { transports: { file: {} }, info() {}, warn() {}, error() {} };
    const module = loadElectronModule('electron/auto-updater.ts', {
        electron: { app, powerMonitor, ipcMain: { on() {}, handle() {} } },
        'electron-updater': { autoUpdater: updater },
        'electron-log': log
    }, {
        setTimeout: (fn, delay) => { timers.set(fn, delay); return fn; },
        clearTimeout: fn => timers.delete(fn)
    });
    module.initializeAutoUpdater({ webContents: { send() {} } });
    await new Promise(setImmediate);
    assert.equal(calls, 1);
    for (const expectedDelay of [30_000, 60_000, 120_000]) {
        const [fn, delay] = [...timers][0];
        assert.equal(delay, expectedDelay);
        timers.delete(fn);
        fn();
        await new Promise(setImmediate);
    }
    assert.equal(calls, 4);
    assert.equal(timers.size, 0);
    powerMonitor.emit('resume');
    assert.equal([...timers.values()][0], 15_000);
    assert.equal(calls, 4);
    app.emit('before-quit');
    assert.equal(timers.size, 0);
});
