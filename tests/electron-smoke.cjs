const assert = require('node:assert/strict');
const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.setPath('userData', process.argv[2]);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const window = new BrowserWindow({
        show: false,
        webPreferences: { preload: path.resolve('dist-electron/preload.mjs'), contextIsolation: true }
    });
    ipcMain.on('smoke:ready', event => event.sender.send('smoke:state', { isTracking: false }));
    await window.loadURL('data:text/html,<html><body>Isolated preload regression check</body></html>');
    const result = await window.webContents.executeJavaScript(`
        new Promise(resolve => {
            let staleCalls = 0;
            for (let i = 0; i < 40; i++) {
                const oldState = () => { staleCalls++; };
                const unsubscribe = window.ipcRenderer.on('smoke:state', oldState);
                unsubscribe();
            }
            const currentState = (_event, state) => {
                unsubscribeCurrent();
                resolve({ staleCalls, isTracking: state.isTracking });
            };
            const unsubscribeCurrent = window.ipcRenderer.on('smoke:state', currentState);
            window.ipcRenderer.send('smoke:ready');
        })
    `);
    assert.deepEqual(result, { staleCalls: 0, isTracking: false });
    console.log('PASS: built preload removes listeners across the real Electron context bridge.');
    window.destroy();
    app.exit(0);
}).catch(error => {
    console.error(error);
    app.exit(1);
});
