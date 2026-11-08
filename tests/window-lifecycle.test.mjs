import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadElectronModule } from './load-electron-module.mjs';

function setup() {
    const app = new EventEmitter();
    const powerMonitor = new EventEmitter();
    const screen = new EventEmitter();
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
    screen.getAllDisplays = () => [{ workArea }];
    screen.getPrimaryDisplay = () => ({ workArea });
    const tasks = new Set();
    const window = new EventEmitter();
    const contents = new EventEmitter();
    let bounds = { x: 2200, y: 30, width: 800, height: 600 };
    let minimized = true;
    let visible = false;
    let destroyed = false;
    let reloads = 0;
    let prompts = 0;
    const calls = [];
    Object.assign(window, {
        id: 1,
        webContents: contents,
        isDestroyed: () => destroyed,
        isMinimized: () => minimized,
        isVisible: () => visible,
        getBounds: () => bounds,
        setBounds: value => { bounds = value; },
        restore: () => { minimized = false; calls.push('restore'); },
        show: () => { visible = true; calls.push('show'); },
        focus: () => calls.push('focus')
    });
    Object.assign(contents, {
        isDestroyed: () => destroyed,
        isLoading: () => false,
        reload: () => { reloads++; },
        forcefullyCrashRenderer: () => contents.emit('render-process-gone', {}, { reason: 'killed' })
    });
    const lifecycle = loadElectronModule('electron/window-lifecycle.ts', {
        electron: { app, powerMonitor, screen,
            dialog: { showMessageBox: async () => { prompts++; return { response: 1 }; } } }
    }, {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: fn => { tasks.add(fn); return fn; },
        clearTimeout: fn => tasks.delete(fn)
    });
    return { lifecycle, window, contents, app, powerMonitor, screen, calls,
        get bounds() { return bounds; }, get reloads() { return reloads; }, get prompts() { return prompts; },
        destroy: () => { destroyed = true; window.emit('closed'); },
        flush: () => { for (const task of [...tasks]) { tasks.delete(task); task(); } }
    };
}

test('reopening restores, shows, and focuses a window on an available monitor', () => {
    const env = setup();
    env.lifecycle.revealWindow(env.window);
    assert.deepEqual(env.calls, ['restore', 'show', 'focus']);
    assert.ok(env.bounds.x >= 0 && env.bounds.x + env.bounds.width <= 1920);
    assert.ok(env.bounds.y >= 0 && env.bounds.y + env.bounds.height <= 1080);
});

test('wake and display removal recover offscreen bounds without opening hidden windows', () => {
    const env = setup();
    env.lifecycle.installWindowRecovery(env.window, 'main');
    env.powerMonitor.emit('resume');
    env.flush();
    env.screen.emit('display-removed');
    assert.ok(env.bounds.x < 1920);
    assert.deepEqual(env.calls, []);
    env.destroy();
    assert.equal(env.powerMonitor.listenerCount('resume'), 0);
    assert.equal(env.screen.listenerCount('display-removed'), 0);
    assert.equal(env.app.listenerCount('before-quit'), 0);
});

test('renderer termination recovers at most three times per minute', () => {
    const env = setup();
    env.lifecycle.installWindowRecovery(env.window, 'mini-player');
    for (let i = 0; i < 10; i++) env.contents.emit('render-process-gone', {}, { reason: 'crashed' });
    assert.equal(env.reloads, 3);
});

test('normal exits, app shutdown, and destroyed windows never trigger recovery', () => {
    const env = setup();
    env.lifecycle.installWindowRecovery(env.window, 'main');
    env.contents.emit('render-process-gone', {}, { reason: 'clean-exit' });
    env.app.emit('before-quit');
    env.contents.emit('render-process-gone', {}, { reason: 'killed' });
    env.destroy();
    env.contents.emit('render-process-gone', {}, { reason: 'crashed' });
    assert.equal(env.reloads, 0);
});

test('unresponsive recovery asks once and reloads in a fresh renderer', async () => {
    const env = setup();
    env.lifecycle.installWindowRecovery(env.window, 'main');
    env.window.emit('unresponsive');
    env.window.emit('unresponsive');
    await new Promise(setImmediate);
    assert.equal(env.prompts, 1);
    assert.equal(env.reloads, 1);
});
