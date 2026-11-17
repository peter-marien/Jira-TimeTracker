const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, session, ipcMain, powerMonitor } = require('electron');

// Validate isolation before importing ANY application module or creating windows.
const profile = fs.realpathSync(process.argv[2]);
assert.equal(path.dirname(profile), fs.realpathSync(os.tmpdir()));
assert.ok(path.basename(profile).startsWith('jira-timetracker-app-test-'));
app.setPath('userData', profile);
app.setPath('sessionData', profile);
app.disableHardwareAcceleration();
// A smoke run must not change the user's OAuth protocol registration.
app.setAsDefaultProtocolClient = () => true;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = (window, expression) => window.webContents.executeJavaScript(expression);
async function waitFor(check) {
    for (let i = 0; i < 100; i++) {
        if (await check()) return;
        await delay(100);
    }
    throw new Error('Timed out waiting for application UI');
}

const mainWindow = new Promise(resolve => app.once('browser-window-created', (_event, window) => {
    window.hide();
    window.webContents.setBackgroundThrottling(false);
    window.setSize(1280, 900);
    resolve(window);
}));
app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => {
        callback({ cancel: true });
    });
});

(async () => {
    const entry = path.resolve(process.argv[3] || 'dist-electron/main.js');
    await import(pathToFileURL(entry).href);
    const window = await mainWindow;
    await waitFor(() => evaluate(window, `document.body.innerText.includes('Dashboard')`));
    const databasePath = await evaluate(window, `window.ipcRenderer.invoke('database:get-path')`);
    assert.equal(path.dirname(databasePath), profile);
    assert.ok(fs.existsSync(databasePath));
    // Dismiss first-run setup without supplying any real Jira credentials.
    await waitFor(() => evaluate(window, `document.body.innerText.includes('Add Your First Jira Connection')`));
    await evaluate(window, `Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(b => /later/i.test(b.textContent)).click()`);
    await waitFor(() => evaluate(window, `!document.querySelector('[role="alertdialog"]')`));
    await delay(300);

    const artifacts = process.env.JIRA_TEST_ARTIFACTS;
    if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
    // Exercise the real IPC handlers and native database, all inside the guarded profile.
    await evaluate(window, `window.location.hash = '/settings'`);
    await waitFor(() => evaluate(window, `document.body.innerText.includes('Appearance')`));
    const active = await evaluate(window, `(async () => {
        const invoke = window.ipcRenderer.invoke;
        await invoke('db:save-connection', { name: 'Disabled fixture', base_url: 'https://jira.invalid', email: 'fixture@example.invalid', api_token: 'fixture', is_enabled: 0 });
        const item = await invoke('db:save-work-item', { jira_connection_id: null, jira_key: null, description: 'Fixture task' });
        await invoke('db:save-time-slice', { work_item_id: item.id, start_time: new Date(Date.now() - 3600000).toISOString(), end_time: null, notes: 'Fixture note' });
        return invoke('tracking:get-state');
    })()`);
    assert.equal(active.activeSlice.notes, 'Fixture note');
    const mini = new BrowserWindow({
        show: false, frame: false, width: 420, height: 72,
        webPreferences: { preload: path.join(path.dirname(entry), 'preload.mjs'), contextIsolation: true, backgroundThrottling: false, offscreen: true }
    });
    await mini.loadFile(path.join(path.dirname(entry), '../dist/mini-player.html'));
    await waitFor(() => evaluate(mini, `document.body.innerText.includes('Fixture task')`));
    for (const theme of ['dark', 'light']) {
        await evaluate(window, `window.ipcRenderer.invoke('db:save-setting', { key: 'mini_player_theme', value: '${theme}' })`);
        await waitFor(() => evaluate(mini, `!!document.querySelector('.mini-player.${theme}')`));
        await delay(200);
        if (artifacts) fs.writeFileSync(path.join(artifacts, `mini-player-${theme}.png`), (await mini.webContents.capturePage()).toPNG());
    }
    const end = await evaluate(mini, `window.ipcRenderer.invoke('tracking:stop')`);
    assert.equal(typeof end, 'string');
    powerMonitor.emit('resume');
    await waitFor(() => evaluate(mini, `!!document.querySelector('.mini-player.idle')`));
    const stopped = await evaluate(window, `window.ipcRenderer.invoke('tracking:get-state')`);
    assert.equal(stopped.activeSlice, null);
    const saved = await evaluate(window, `window.ipcRenderer.invoke('db:get-time-slice', ${active.activeSlice.id})`);
    assert.equal(saved.notes, 'Fixture note');
    assert.equal(saved.end_time, end);

    const away = new BrowserWindow({
        show: false, frame: false, width: 550, height: 730,
        webPreferences: { preload: path.join(path.dirname(entry), 'preload.mjs'), contextIsolation: true, backgroundThrottling: false, offscreen: true }
    });
    const onAwayReady = event => {
        if (event.sender === away.webContents) event.sender.send('away:data', {
            awayStartTime: new Date(Date.now() - 600000).toISOString(),
            awayDurationSeconds: 600, currentWorkItem: active.workItem
        });
    };
    ipcMain.on('away-window:ready', onAwayReady);
    await away.loadFile(path.join(path.dirname(entry), '../dist/index.html'), { hash: 'away' });
    await waitFor(() => evaluate(away, `document.body.innerText.includes('Fixture task')`));
    ipcMain.removeListener('away-window:ready', onAwayReady);
    for (const theme of ['dark', 'light']) {
        await evaluate(away, `document.documentElement.classList.toggle('dark', ${theme === 'dark'})`);
        await delay(300);
        if (artifacts) fs.writeFileSync(path.join(artifacts, `away-${theme}.png`), (await away.webContents.capturePage()).toPNG());
    }
    away.destroy();
    mini.destroy();
    await evaluate(window, `window.location.hash = '/'`);
    await waitFor(() => evaluate(window, `document.body.innerText.includes('Dashboard')`));
    const dateButton = `Array.from(document.querySelectorAll('button')).find(b => /\\b\\d{4}\\b/.test(b.textContent))`;
    const originalDate = await evaluate(window, `${dateButton}.textContent`);
    await evaluate(window, `${dateButton}.click()`);
    await waitFor(() => evaluate(window, `!!document.querySelector('[data-slot="calendar"]')`));
    const caption = () => evaluate(window, `document.querySelector('.rdp-month_caption').textContent`);
    const originalMonth = await caption();
    await evaluate(window, `document.querySelector('.rdp-button_next').click()`);
    await waitFor(async () => await caption() !== originalMonth);
    await evaluate(window, `document.querySelector('.rdp-button_previous').click()`);
    await waitFor(async () => await caption() === originalMonth);
    await delay(300);
    if (artifacts) fs.writeFileSync(path.join(artifacts, 'calendar.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate(window, `Array.from(document.querySelectorAll('button[data-day]')).find(b => ['10', '15'].includes(b.textContent) && b.dataset.selectedSingle !== 'true' && !b.disabled).click()`);
    await waitFor(async () => await evaluate(window, `${dateButton}.textContent`) !== originalDate);
    await evaluate(window, `document.querySelector('[data-slot="calendar"]')?.closest('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await delay(200);
    await evaluate(window, `Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Today')?.click()`);
    for (const [name, route] of [['dashboard', '/'], ['month', '/month'], ['reports', '/reports'], ['settings', '/settings']]) {
        await evaluate(window, `window.location.hash = ${JSON.stringify(route)}`);
        await delay(500);
        assert.ok(await evaluate(window, `document.querySelector('#root').textContent.length > 30`));
        for (const theme of ['dark', 'light']) {
            await evaluate(window, `document.documentElement.classList.toggle('dark', ${theme === 'dark'})`);
            await delay(100);
            if (artifacts) fs.writeFileSync(path.join(artifacts, `${name}-${theme}.png`), (await window.webContents.capturePage()).toPNG());
        }
    }
    assert.ok(BrowserWindow.getAllWindows().length > 0);
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify({ passed: true, databaseIsolated: true }));
    app.exit(0);
})().catch(error => {
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify({ passed: false, error: error.stack }));
    app.exit(1);
});
