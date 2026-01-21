import { BrowserWindow, screen, ipcMain } from 'electron';
import type { Rectangle } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VITE_DEV_SERVER_URL, RENDERER_DIST } from './main';
import { getAppConfig, saveAppConfig } from './config-service';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let miniPlayerWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

export interface TrackingData {
    isTracking: boolean;
    elapsedSeconds: number;
    jiraKey?: string | null;
    description: string;
    startTime?: string;
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
        showMiniPlayer(data);
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

    ipcMain.on('mini-player:set-search-active', (event, active: boolean) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;

        const bounds = win.getBounds();
        const IDLE_HEIGHT = 72;
        const SEARCH_HEIGHT = 500;

        if (active && bounds.height < SEARCH_HEIGHT) {
            // Expand upwards
            win.setMinimumSize(300, SEARCH_HEIGHT);
            win.setMaximumSize(9999, SEARCH_HEIGHT);
            win.setBounds({
                x: bounds.x,
                y: bounds.y - (SEARCH_HEIGHT - IDLE_HEIGHT),
                width: bounds.width,
                height: SEARCH_HEIGHT
            }, true);
        } else if (!active && bounds.height >= SEARCH_HEIGHT) {
            // Shrink downwards
            win.setMinimumSize(300, IDLE_HEIGHT);
            win.setMaximumSize(9999, IDLE_HEIGHT);
            win.setBounds({
                x: bounds.x,
                y: bounds.y + (SEARCH_HEIGHT - IDLE_HEIGHT),
                width: bounds.width,
                height: IDLE_HEIGHT
            }, true);
        }
    });

    // When tracking starts from mini-player, notify main window to sync state
    ipcMain.on('mini-player:tracking-started', (_, data) => {
        mainWindow?.webContents.send('mini-player:tracking-started', data);
    });

    ipcMain.on('mini-player:stopped-for-switch', () => {
        mainWindow?.webContents.send('tracking:refresh');
    });

    ipcMain.on('window:minimize-to-mini-player', () => {
        mainWindow?.minimize();
        // The minimize event will trigger request-state
    });
}



function isRectVisible(rect: Rectangle): boolean {
    const displays = screen.getAllDisplays();
    // Check if the center of the window is within any display
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    return displays.some(display => {
        const { x, y, width, height } = display.bounds;
        return (
            centerX >= x &&
            centerX < x + width &&
            centerY >= y &&
            centerY < y + height
        );
    });
}

function getSafeBounds(configBounds: Rectangle | undefined, defaultWidth = 360, defaultHeight = 80): Rectangle {
    const { workArea } = screen.getPrimaryDisplay();
    const defaultBounds = {
        x: Math.floor(workArea.x + workArea.width - defaultWidth - 20),
        y: Math.floor(workArea.y + workArea.height - defaultHeight - 20),
        width: defaultWidth,
        height: defaultHeight
    };

    if (!configBounds) return defaultBounds;

    // Check visibility
    if (isRectVisible(configBounds)) {
        return configBounds;
    }

    // If not visible, return default on primary monitor
    return defaultBounds;
}

function createMiniPlayerWindow(): BrowserWindow {
    const config = getAppConfig();

    // Determine safe initial bounds
    const safeBounds = getSafeBounds(config.miniPlayer, 360, 72);

    const win = new BrowserWindow({
        width: safeBounds.width,
        height: 72, // Force idle height
        x: safeBounds.x,
        y: safeBounds.y,
        minWidth: 300,
        minHeight: 72,
        maxHeight: 72, // Disable vertical resizing
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
    // Only allow showing if main window is minimized
    // This enforces the rule: "When app is not minimized, mini-player should not be visible"
    if (mainWindow && !mainWindow.isMinimized()) {
        return;
    }

    if (!miniPlayerWindow) {
        miniPlayerWindow = createMiniPlayerWindow();
    } else {
        // Ensure window is visible (in case monitors changed while app was running)
        const bounds = miniPlayerWindow.getBounds();
        if (!isRectVisible(bounds)) {
            const safe = getSafeBounds(bounds, bounds.width, bounds.height);
            miniPlayerWindow.setBounds(safe);
        }
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
