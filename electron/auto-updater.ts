import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';
import log from 'electron-log';

// Configure logging
autoUpdater.logger = log;
(autoUpdater.logger as typeof log).transports.file.level = 'info';

export function initializeAutoUpdater(window: BrowserWindow) {
    autoUpdater.checkForUpdatesAndNotify();

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
        autoUpdater.checkForUpdatesAndNotify();
    }, minutes * 60 * 1000);
}
