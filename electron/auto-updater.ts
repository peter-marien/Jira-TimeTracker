import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
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
        dialog.showMessageBox(window, {
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded and is ready to install.`,
            buttons: ['Restart Now', 'Later']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (err) => {
        log.error('Auto-update error:', err);
    });
}
