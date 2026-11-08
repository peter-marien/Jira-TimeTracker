import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadElectronModule } from './load-electron-module.mjs';

function createBridge() {
    const ipc = new EventEmitter();
    let bridge;
    loadElectronModule('electron/preload.ts', {
        electron: {
            ipcRenderer: ipc,
            contextBridge: { exposeInMainWorld: (_name, api) => { bridge = api; } }
        }
    });
    return { ipc, bridge };
}

test('subscription cleanup removes wrapped callbacks across repeated tracking updates', () => {
    const { ipc, bridge } = createBridge();
    let oldCalls = 0;
    for (let i = 0; i < 20; i++) {
        const oldTrackingState = () => { oldCalls++; };
        const unsubscribe = bridge.on('mini-player:request-state', oldTrackingState);
        unsubscribe();
        unsubscribe();
    }
    ipc.emit('mini-player:request-state', {});
    assert.equal(oldCalls, 0);
    assert.equal(ipc.listenerCount('mini-player:request-state'), 0);
});

test('removing a callback preserves other callbacks and channels', () => {
    const { ipc, bridge } = createBridge();
    let calls = 0;
    const listener = () => { calls++; };
    const unsubscribe = bridge.on('tracking:state', listener);
    bridge.on('setting:updated', listener);
    bridge.on('tracking:state', () => { calls += 10; });
    unsubscribe();
    ipc.emit('tracking:state', {}, {});
    ipc.emit('setting:updated', {}, {});
    assert.equal(calls, 11);
});
