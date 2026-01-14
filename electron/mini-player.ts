import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VITE_DEV_SERVER_URL, RENDERER_DIST } from './main';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let miniPlayerWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

export interface TrackingData {
    isTracking: boolean;
    elapsedSeconds: number;
    jiraKey?: string | null;
    description: string;
}

export function initializeMiniPlayer(main: BrowserWindow) {
    mainWindow = main;

    // Listen for main window minimize
    mainWindow.on('minimize', () => {
        // Request tracking state from renderer to decide if we should show mini player
        mainWindow?.webContents.send('mini-player:request-state');
    });

    // Listen for main window restore
    mainWindow.on('restore', () => {
        hideMiniPlayer();
    });

    mainWindow.on('show', () => {
        hideMiniPlayer();
    });

    // Register IPC handlers
    ipcMain.on('mini-player:show', (_, data: TrackingData) => {
        if (data.isTracking) {
            showMiniPlayer(data);
        }
    });

    ipcMain.on('mini-player:hide', () => {
        hideMiniPlayer();
    });

    ipcMain.on('mini-player:update-state', (_, data: TrackingData) => {
        updateMiniPlayerState(data);
    });

    ipcMain.on('mini-player:stop-tracking', () => {
        // Forward stop command to main window
        mainWindow?.webContents.send('mini-player:stop-tracking');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
        hideMiniPlayer();
    });

    ipcMain.on('mini-player:expand', () => {
        expandToMainWindow();
    });

    ipcMain.on('window:minimize-to-mini-player', () => {
        mainWindow?.minimize();
        // The minimize event will trigger request-state
    });
}

import { getAppConfig, saveAppConfig } from './config-service';

function createMiniPlayerWindow(): BrowserWindow {
    const config = getAppConfig();
    const { workArea } = screen.getPrimaryDisplay();

    // Default size and position
    let width = 360;
    let height = 80;
    let x = Math.floor(workArea.x + workArea.width - width - 20);
    let y = Math.floor(workArea.y + workArea.height - height - 20);

    // Override with saved config if available
    if (config.miniPlayer) {
        width = config.miniPlayer.width;
        height = config.miniPlayer.height;
        x = config.miniPlayer.x;
        y = config.miniPlayer.y;
    }

    const win = new BrowserWindow({
        width,
        height,
        x,
        y,
        minWidth: 300,
        minHeight: 60,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        skipTaskbar: true,
        focusable: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            contextIsolation: true,
        },
    });

    // Save bounds on resize/move (debounced)
    let saveTimeout: NodeJS.Timeout;
    const saveState = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (!win.isDestroyed()) {
                const bounds = win.getBounds();
                saveAppConfig({ miniPlayer: bounds });
            }
        }, 500);
    };

    win.on('resize', saveState);
    win.on('move', saveState);

    // Load mini player page
    if (VITE_DEV_SERVER_URL) {
        win.loadURL(`${VITE_DEV_SERVER_URL}mini-player.html`);
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'mini-player.html'));
    }

    win.on('closed', () => {
        miniPlayerWindow = null;
    });

    return win;
}

export function showMiniPlayer(data: TrackingData) {
    if (!miniPlayerWindow) {
        miniPlayerWindow = createMiniPlayerWindow();
    }

    miniPlayerWindow.webContents.once('did-finish-load', () => {
        miniPlayerWindow?.webContents.send('mini-player:state', data);
        miniPlayerWindow?.show();
    });

    // If already loaded, just update and show
    if (!miniPlayerWindow.webContents.isLoading()) {
        miniPlayerWindow.webContents.send('mini-player:state', data);
        miniPlayerWindow.show();
    }
}

export function hideMiniPlayer() {
    if (miniPlayerWindow) {
        miniPlayerWindow.hide();
    }
}

export function updateMiniPlayerState(data: TrackingData) {
    if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
        miniPlayerWindow.webContents.send('mini-player:state', data);

        // If tracking stopped, hide the mini player
        if (!data.isTracking) {
            hideMiniPlayer();
        }
    }
}

export function expandToMainWindow() {
    hideMiniPlayer();
    if (mainWindow) {
        mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
}
