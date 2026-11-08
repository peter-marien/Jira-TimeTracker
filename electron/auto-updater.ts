import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app, powerMonitor } from 'electron';
import log from 'electron-log';

// Configure logging
autoUpdater.logger = log;
(autoUpdater.logger as typeof log).transports.file.level = 'info';

let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryAttempts = 0;
let checkInProgress = false;
let quitting = false;

async function checkInBackground() {
    if (quitting || checkInProgress) return;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    checkInProgress = true;
    try {
        await autoUpdater.checkForUpdatesAndNotify();
        retryAttempts = 0;
    } catch (error) {
        log.warn('Background update check failed; will retry when connectivity returns.', error);
        if (!quitting && retryAttempts < 3) {
            const delay = 30_000 * 2 ** retryAttempts++;
            retryTimer = setTimeout(() => { void checkInBackground(); }, delay);
        }
    } finally {
        checkInProgress = false;
    }
}

export function initializeAutoUpdater(window: BrowserWindow) {

    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Update available:', info.version);
    });

    autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available. Current version:', app.getVersion(), 'Latest version:', info.version);
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded:', info.version);
        // Notify renderer that update is ready
        window.webContents.send('update:downloaded', {
            version: info.version,
            releaseNotes: info.releaseNotes
        });
    });

    autoUpdater.on('error', (err) => {
        log.error('Auto-update error:', err);
    });

    powerMonitor.on('resume', () => {
        retryAttempts = 0;
        clearTimeout(retryTimer);
        // Allow networking to settle after Windows wakes.
        retryTimer = setTimeout(() => { void checkInBackground(); }, 15_000);
    });
    app.once('before-quit', () => {
        quitting = true;
        clearTimeout(retryTimer);
        if (updateIntervalId) clearInterval(updateIntervalId);
    });
    void checkInBackground();

    // Handle quit and install request from renderer
    ipcMain.on('update:quit-and-install', () => {
        log.info('Quit and install update requested.');
        autoUpdater.quitAndInstall();
    });

    // Handle manual update check
    ipcMain.handle('update:check', async () => {
        log.info('Manual update check requested.');
        try {
            const result = await autoUpdater.checkForUpdates();
            // Return simplified result
            return {
                updateAvailable: !!result && result.updateInfo.version !== app.getVersion(),
                version: result?.updateInfo.version
            };
        } catch (error) {
            log.error('Manual update check error:', error);
            throw error;
        }
    });
}

let updateIntervalId: NodeJS.Timeout | null = null;

export function startUpdateInterval(minutes: number) {
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
        updateIntervalId = null;
    }

    if (minutes <= 0) {
        log.info('Auto-update interval disabled.');
        return;
    }

    log.info(`Starting auto-update check every ${minutes} minutes.`);
    // Run immediately? No, we already check on startup. Wait for interval.
    updateIntervalId = setInterval(() => {
        log.info('Running periodic update check...');
        retryAttempts = 0;
        void checkInBackground();
    }, minutes * 60 * 1000);
}
