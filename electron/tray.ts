import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';

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
    const icon = nativeImage.createFromPath(path.join(publicDir || '', 'electron-vite.svg')); // Use existing svg as fallback

    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show/Hide', click: toggleWindow },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);

    tray.setToolTip('Jira Time Tracker');
    tray.setContextMenu(contextMenu);

    tray.on('click', toggleWindow);
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

export function updateTrayIcon(type: 'active' | 'idle') {
    if (tray) {
        const publicDir = process.env.VITE_PUBLIC;
        // Fallback to electron-vite.svg if specific icons don't exist yet to prevent invisible tray
        // const iconName = type === 'active' ? 'tray-icon-active.png' : 'tray-icon.png';
        // For now, defaulting to svg to ensure visibility until assets are added
        const iconPath = path.join(publicDir || '', 'electron-vite.svg');

        // When assets are available:
        // const iconPath = path.join(publicDir || '', iconName);
        try {
            const icon = nativeImage.createFromPath(iconPath);
            if (!icon.isEmpty()) {
                tray.setImage(icon.resize({ width: 16, height: 16 }));
            }
        } catch (e) {
            console.error("Failed to load tray icon", e);
        }
    }
}
