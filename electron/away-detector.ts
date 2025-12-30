import { powerMonitor, BrowserWindow, ipcMain } from 'electron';
import { getDatabase } from '../src/database/db';

let mainWindow: BrowserWindow | null = null;
let awayStartTime: Date | null = null;
let isTrackingActive = false;
let wasIdle = false;

// Get threshold from settings (default 5 minutes)
async function getThresholdSeconds(): Promise<number> {
    try {
        const db = getDatabase();
        const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('away_threshold_minutes') as { value: string } | undefined;
        const minutes = result ? parseInt(result.value, 10) : 5;
        return minutes * 60;
    } catch {
        return 5 * 60; // Default 5 minutes
    }
}

// Check if away detection is enabled
async function isEnabled(): Promise<boolean> {
    try {
        const db = getDatabase();
        const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('away_detection_enabled') as { value: string } | undefined;
        return result ? result.value === 'true' : true; // Enabled by default
    } catch {
        return true;
    }
}

// Check if there's an active time slice (tracking in progress)
function checkTrackingActive(): boolean {
    try {
        const db = getDatabase();
        const result = db.prepare('SELECT id FROM time_slices WHERE end_time IS NULL LIMIT 1').get();
        return !!result;
    } catch {
        return false;
    }
}

function handleAwayStart(reason: string) {
    isTrackingActive = checkTrackingActive();
    if (isTrackingActive && !awayStartTime) {
        awayStartTime = new Date();
        console.log(`[AwayDetector] User went away (${reason}) at:`, awayStartTime.toISOString());
    }
}

async function handleAwayEnd(reason: string) {
    if (!awayStartTime || !isTrackingActive) {
        awayStartTime = null;
        wasIdle = false;
        return;
    }

    const enabled = await isEnabled();
    if (!enabled) {
        awayStartTime = null;
        wasIdle = false;
        return;
    }

    const now = new Date();
    const awayDurationSeconds = Math.floor((now.getTime() - awayStartTime.getTime()) / 1000);
    const thresholdSeconds = await getThresholdSeconds();

    console.log(`[AwayDetector] User returned (${reason}). Away for ${awayDurationSeconds}s (threshold: ${thresholdSeconds}s)`);

    if (awayDurationSeconds >= thresholdSeconds && mainWindow) {
        // Notify renderer about away time
        mainWindow.webContents.send('away:detected', {
            awayStartTime: awayStartTime.toISOString(),
            awayDurationSeconds
        });
        console.log('[AwayDetector] Sent away:detected event to renderer');
    }

    awayStartTime = null;
    isTrackingActive = false;
    wasIdle = false;
}

// Check idle state periodically
async function checkIdleState() {
    const enabled = await isEnabled();
    if (!enabled) return;

    const thresholdSeconds = await getThresholdSeconds();
    const idleSeconds = powerMonitor.getSystemIdleTime();

    // User is now idle (beyond threshold)
    if (idleSeconds >= thresholdSeconds && !wasIdle) {
        wasIdle = true;
        // Calculate when they actually became idle
        const idleStartTime = new Date(Date.now() - idleSeconds * 1000);
        awayStartTime = idleStartTime;
        isTrackingActive = checkTrackingActive();
        if (isTrackingActive) {
            console.log(`[AwayDetector] User became idle at: ${awayStartTime.toISOString()} (${idleSeconds}s ago)`);
        }
    }

    // User was idle but is now active again
    if (idleSeconds < 10 && wasIdle && awayStartTime) {
        console.log('[AwayDetector] User returned from idle');
        await handleAwayEnd('idle');
    }
}

export function initializeAwayDetector(win: BrowserWindow) {
    mainWindow = win;

    // Lock/Unlock events (Windows, macOS, Linux)
    powerMonitor.on('lock-screen', () => {
        console.log('[AwayDetector] Screen locked');
        handleAwayStart('lock');
    });

    powerMonitor.on('unlock-screen', () => {
        console.log('[AwayDetector] Screen unlocked');
        handleAwayEnd('unlock');
    });

    // Suspend/Resume events (sleep/wake)
    powerMonitor.on('suspend', () => {
        console.log('[AwayDetector] System suspended');
        handleAwayStart('suspend');
    });

    powerMonitor.on('resume', () => {
        console.log('[AwayDetector] System resumed');
        handleAwayEnd('resume');
    });

    // Start idle check polling (every 5 seconds for responsive detection)
    setInterval(checkIdleState, 5000);
    console.log('[AwayDetector] Started idle check interval (5s)');

    // IPC handlers for settings
    ipcMain.handle('away:get-threshold', async () => {
        const seconds = await getThresholdSeconds();
        return seconds / 60; // Return minutes
    });

    ipcMain.handle('away:get-enabled', async () => {
        return await isEnabled();
    });

    console.log('[AwayDetector] Initialized');
}
