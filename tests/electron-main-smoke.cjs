const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');
const { app, BrowserWindow } = require('electron');

app.setPath('userData', process.argv[2]);
app.disableHardwareAcceleration();
// Keep the test separate from the user's running app and OS protocol registration.
app.requestSingleInstanceLock = () => true;
app.setAsDefaultProtocolClient = () => true;

async function main() {
    await import(pathToFileURL(path.resolve('dist-electron/main.js')).href);
    await app.whenReady();
    const window = BrowserWindow.getAllWindows()[0];
    assert.ok(window, 'The production main process opened the renderer.');
    for (let attempt = 0; attempt < 100; attempt++) {
        if (!window.webContents.isLoading() && await window.webContents.executeJavaScript(
            'document.querySelector("main h1")?.textContent === "Dashboard"'
        )) break;
        if (attempt === 99) throw new Error('The production Dashboard did not render.');
        await delay(45);
    }

    const invoke = (channel, ...args) => window.webContents.executeJavaScript(
        `window.ipcRenderer.invoke(${[channel, ...args].map(value => JSON.stringify(value)).join(',')})`
    );
    const first = await invoke('db:save-work-item', { description: 'First smoke-test work item' });
    const second = await invoke('db:save-work-item', { description: 'Second smoke-test work item' });
    const started = new Date(Date.now() - 3600_000).toISOString();
    await invoke('tracking:start', first.id, started);
    assert.equal((await invoke('tracking:get-state')).workItem.id, first.id);
    await assert.rejects(invoke('tracking:start', -1), /FOREIGN KEY/);
    assert.equal((await invoke('tracking:get-state')).workItem.id, first.id);

    const firstSlice = (await invoke('db:get-work-item-time-slices', first.id))[0];
    await assert.rejects(invoke('db:change-time-slices', {
        remove: firstSlice.id,
        save: [{ work_item_id: -1, start_time: started }]
    }), /FOREIGN KEY/);
    assert.equal((await invoke('tracking:get-state')).activeSlice.id, firstSlice.id);

    await invoke('tracking:resolve-away', 'reassign', new Date(Date.now() - 10 * 60_000).toISOString(), second.id);
    assert.equal((await invoke('tracking:get-state')).workItem.id, first.id);
    const [away] = await invoke('db:get-work-item-time-slices', second.id);
    assert.ok(away.end_time);
    await invoke('tracking:start', second.id);
    assert.equal((await invoke('tracking:get-state')).workItem.id, second.id);
    await invoke('tracking:stop');
    assert.equal((await invoke('tracking:get-state')).activeSlice, null);

    const oauth = await invoke('db:save-connection-oauth', {
        name: 'Local auth fixture', base_url: 'https://example.invalid', is_enabled: 1, is_default: 0,
        auth_type: 'oauth', client_id: 'test-client-id', client_secret_encrypted: 'test-encrypted-secret',
        access_token_encrypted: 'test-encrypted-access', refresh_token_encrypted: 'test-encrypted-refresh', cloud_id: 'test-cloud'
    });
    await invoke('db:save-connection-oauth', {
        id: oauth.id, name: 'Renamed local auth fixture', base_url: 'https://example.invalid', is_enabled: 1,
        is_default: 1, auth_type: 'oauth', client_id: 'test-client-id', cloud_id: 'test-cloud'
    });
    const [connection] = await invoke('db:get-all-connections');
    assert.equal(connection.name, 'Renamed local auth fixture');
    assert.equal(connection.access_token_encrypted, 'test-encrypted-access');

    process.stdout.write('PASS: production main process, Angular Dashboard, SQLite tracking, transaction rollback, and OAuth metadata updates.\n');
}

main().then(() => app.exit(0)).catch(error => {
    process.stderr.write(String(error.stack || error) + '\n');
    app.exit(1);
});
