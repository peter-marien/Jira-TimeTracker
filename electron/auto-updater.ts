import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';

// Configure logging
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = 'info';

export function initializeAutoUpdater(window: BrowserWindow) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        log.info('Update available.');
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded.');
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
