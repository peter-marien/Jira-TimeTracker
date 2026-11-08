import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadElectronModule } from './load-electron-module.mjs';

function setup() {
    const main = new EventEmitter();
    let minimized = true;
    main.isMinimized = () => minimized;
    const ipc = new EventEmitter();
    const windows = [];
    let snapshot = { revision: 1, activeSlice: { id: 1 }, workItem: { id: 1 } };
    class Window extends EventEmitter {
        constructor(options) {
            super();
            this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
            this.visible = false;
            this.loading = true;
            this.messages = [];
            this.webContents = new EventEmitter();
            this.webContents.isLoading = () => this.loading;
            this.webContents.send = (channel, value) => this.messages.push({ channel, value });
            windows.push(this);
        }
        getBounds() { return this.bounds; }
        setBounds(bounds) { this.bounds = bounds; }
        isDestroyed() { return false; }
        show() { this.visible = true; }
        hide() { this.visible = false; }
        loadFile() {}
        loadURL() {}
    }
    const display = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
    const module = loadElectronModule('electron/mini-player.ts', {
        electron: { BrowserWindow: Window, ipcMain: ipc, screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display } },
        './main': { RENDERER_DIST: 'test-renderer' },
        './config-service': { getAppConfig: () => ({}), saveAppConfig() {} },
        './tracking-state': { getTrackingSnapshot: () => snapshot },
        './window-lifecycle': { installWindowRecovery() {}, revealWindow() {} }
    });
    module.initializeMiniPlayer(main);
    return { main, ipc, windows,
        restore: () => { minimized = false; main.emit('restore'); },
        stop: () => { snapshot = { revision: 2, activeSlice: null, workItem: null }; }
    };
}

test('repeated minimize events during loading install only one load listener', () => {
    const env = setup();
    for (let i = 0; i < 20; i++) env.main.emit('minimize');
    assert.equal(env.windows.length, 1);
    assert.equal(env.windows[0].webContents.listenerCount('did-finish-load'), 1);
});

test('a restored main window prevents a pending mini-player load from showing the widget', () => {
    const env = setup();
    env.main.emit('minimize');
    env.restore();
    const widget = env.windows[0];
    widget.loading = false;
    widget.webContents.emit('did-finish-load');
    assert.equal(widget.visible, false);
});

test('mini-player load reads the latest saved stop instead of an earlier active state', () => {
    const env = setup();
    env.main.emit('minimize');
    env.stop();
    const widget = env.windows[0];
    widget.loading = false;
    widget.webContents.emit('did-finish-load');
    assert.equal(widget.messages.at(-1).channel, 'tracking:state');
    assert.equal(widget.messages.at(-1).value.activeSlice, null);
    // An old renderer cannot overwrite the authoritative state through the removed channel.
    env.ipc.emit('mini-player:update-state', {}, { isTracking: true });
    env.main.emit('minimize');
    assert.equal(widget.messages.at(-1).value.activeSlice, null);
});

test('hiding a loading mini-player prevents its pending load from showing it again', () => {
    const env = setup();
    env.main.emit('minimize');
    env.ipc.emit('mini-player:hide');
    const widget = env.windows[0];
    widget.loading = false;
    widget.webContents.emit('did-finish-load');
    assert.equal(widget.visible, false);
});
