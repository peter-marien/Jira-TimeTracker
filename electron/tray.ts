import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { startPulsing, stopPulsing } from './tray-animator';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;

// Icons should be in resources/assets or public. 
// For dev, we use public. For prod, resources.
// Using nativeImage.createFromPath handles some of this if paths are correct.
// We'll assume standard 'electron-vite.svg' for now or a placeholder.

export function initializeTray(window: BrowserWindow) {
    mainWindow = window;

    // const iconPath = getIconPath('tray-icon.png'); // Placeholder
    // If icon not found, use default app icon or empty.
    // nativeImage.createFromPath returns empty image if not found.

    // For now, use the public path logic from main.ts
    const publicDir = process.env.VITE_PUBLIC;
    const idlePath = path.join(publicDir || '', 'tray-icon.png');
    console.log('[Tray] Loading idle icon from:', idlePath);
    let icon = nativeImage.createFromPath(idlePath);

    if (icon.isEmpty()) {
        console.warn('[Tray] idle icon is empty, falling back to svg');
        const fallbackPath = path.join(publicDir || '', 'electron-vite.svg');
        icon = nativeImage.createFromPath(fallbackPath);
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
                mainWindow.show();
                mainWindow.focus();
                // We could send an IPC to the renderer to stop or prompt for start
                if (isTracking) {
                    mainWindow.webContents.send('tray:stop-tracking');
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
    if (mainWindow.isVisible()) {
        mainWindow.hide();
    } else {
        mainWindow.show();
        mainWindow.focus();
    }
}



export function updateTrayTooltip(text: string) {
    if (tray) {
        tray.setToolTip(text);
    }
}

export function updateTrayIcon(type: 'active' | 'idle', description?: string) {
    if (tray) {
        const publicDir = process.env.VITE_PUBLIC;
        const idlePath = path.join(publicDir || '', 'tray-icon.png');
        const activePath = path.join(publicDir || '', 'tray-icon-active.png');

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
