import { BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname, '..');
const RENDERER_DIST = path.join(APP_ROOT, 'dist');
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

export interface AwayData {
    awayStartTime: string;
    awayDurationSeconds: number;
    currentWorkItem: unknown;
    // Actually, let's use Record<string, unknown> or just 'any' but explicitly.
    // Given the previous file used 'any', let's try to be better.
    // Use 'unknown' or define a partial shape.
    // In away-detector.ts we pass `WorkItemRow`.
}

let awayWindow: BrowserWindow | null = null;
let pendingAwayData: AwayData | null = null;

export function createAwayWindow(data: AwayData) {
    if (awayWindow && !awayWindow.isDestroyed()) {
        awayWindow.focus();
        awayWindow.webContents.send('away:data', data);
        return;
    }

    pendingAwayData = data;

    awayWindow = new BrowserWindow({
        width: 550,
        height: 730, // Adjusted for content without scrollbar
        resizable: false,
        frame: false,
        // alwaysOnTop: true, // Optional: User might find this annoying if debugging, but requested "standalone" usually implies interrupting.
        autoHideMenuBar: true,
        center: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
        },
        show: false
    });

    awayWindow.once('ready-to-show', () => {
        awayWindow?.show();
    });

    if (VITE_DEV_SERVER_URL) {
        awayWindow.loadURL(`${VITE_DEV_SERVER_URL}#/away`);
    } else {
        awayWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'away' });
    }

    awayWindow.on('closed', () => {
        awayWindow = null;
        ipcMain.emit('away:dialog-closed'); // Signal to detector using the existing event name logic
    });
}

// Handler for when the React component mounts and requests data
ipcMain.on('away-window:ready', (event) => {
    // Only reply if this event came from our away window
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin && senderWin === awayWindow && pendingAwayData) {
        senderWin.webContents.send('away:data', pendingAwayData);
    }
});

export function closeAwayWindow() {
    if (awayWindow && !awayWindow.isDestroyed()) {
        awayWindow.close();
    }
}
