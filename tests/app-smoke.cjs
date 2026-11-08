const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, session } = require('electron');

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
    window.setSize(1280, 900);
    resolve(window);
}));
app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => {
        callback({ cancel: true });
    });
});

(async () => {
    await import(pathToFileURL(path.resolve(process.argv[3] || 'dist-electron/main.js')).href);
    const window = await mainWindow;
    await waitFor(() => evaluate(window, `document.body.innerText.includes('Dashboard')`));
    const databasePath = await evaluate(window, `window.ipcRenderer.invoke('database:get-path')`);
    assert.equal(path.dirname(databasePath), profile);
    assert.ok(fs.existsSync(databasePath));
    // Dismiss first-run setup without supplying any real Jira credentials.
    await evaluate(window, `Array.from(document.querySelectorAll('button')).find(b => /later|skip/i.test(b.textContent))?.click()`);

    const artifacts = process.env.JIRA_TEST_ARTIFACTS;
    if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
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
    if (artifacts) fs.writeFileSync(path.join(artifacts, 'calendar.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate(window, `Array.from(document.querySelectorAll('button[data-day]')).find(b => ['10', '15'].includes(b.textContent) && b.dataset.selectedSingle !== 'true' && !b.disabled).click()`);
    await waitFor(async () => await evaluate(window, `${dateButton}.textContent`) !== originalDate);
    await evaluate(window, `document.querySelector('[data-slot="calendar"]')?.closest('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await delay(200);
    for (const [name, route] of [['dashboard', '/'], ['month', '/month'], ['settings', '/settings']]) {
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
