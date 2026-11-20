import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { startPulsing, stopPulsing } from './tray-animator';
import { stopActiveTracking } from './tracking-state';
import { revealWindow } from './window-lifecycle';
import { assetsDirectory } from './renderer';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;

export function initializeTray(window: BrowserWindow) {
    mainWindow = window;

    const idlePath = path.join(assetsDirectory, 'tray-icon.png');
    console.log('[Tray] Loading idle icon from:', idlePath);
    let icon = nativeImage.createFromPath(idlePath);

    if (icon.isEmpty()) {
        console.warn('[Tray] Idle icon is empty, using the application icon');
        icon = nativeImage.createFromPath(path.join(assetsDirectory, 'app-icon.png'));
    }

    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    updateTrayMenu(false);
    tray.setToolTip('Jira Time Tracker');
    tray.on('click', toggleWindow);
}

function updateTrayMenu(isTracking: boolean, currentWorkItem?: string) {
    if (!tray) return;

    const contextMenu = Menu.buildFromTemplate([
        {
            label: isTracking ? `Tracking: ${currentWorkItem || 'Active'}` : 'Idle',
            enabled: false
        },
        { type: 'separator' },
        { label: 'Show/Hide Window', click: toggleWindow },
        {
            label: isTracking ? 'Stop Tracking' : 'Start Tracking...',
            click: () => {
                if (!mainWindow) return;
                revealWindow(mainWindow);
                if (isTracking) {
                    try {
                        stopActiveTracking();
                    } catch (error) {
                        console.error('[Tray] Failed to stop tracking', error);
                    }
                }
            }
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);

    tray.setContextMenu(contextMenu);
}

function toggleWindow() {
    if (!mainWindow) return;
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
        mainWindow.minimize();
    } else {
        revealWindow(mainWindow);
    }
}



export function updateTrayTooltip(text: string) {
    if (tray) {
        tray.setToolTip(text);
    }
}

export function updateTrayIcon(type: 'active' | 'idle', description?: string) {
    if (tray) {
        const idlePath = path.join(assetsDirectory, 'tray-icon.png');
        const activePath = path.join(assetsDirectory, 'tray-icon-active.png');

        if (type === 'active') {
            console.log('[Tray] Activating pulse with:', activePath);
            const activeIcon = nativeImage.createFromPath(activePath);
            if (activeIcon.isEmpty()) {
                console.warn('[Tray] active icon missing, using idle icon for pulse');
                startPulsing(tray, idlePath, idlePath);
            } else {
                startPulsing(tray, idlePath, activePath);
            }
            updateTrayMenu(true, description);
        } else {
            stopPulsing(tray, idlePath);
            updateTrayMenu(false);
        }
    }
}
