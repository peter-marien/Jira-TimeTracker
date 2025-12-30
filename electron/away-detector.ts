import { powerMonitor, BrowserWindow, ipcMain, Notification } from 'electron';
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

// Check if notification sound is enabled
async function isSoundEnabled(): Promise<boolean> {
    try {
        const db = getDatabase();
        const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('away_notification_sound') as { value: string } | undefined;
        return result ? result.value === 'true' : true; // Enabled by default
    } catch {
        return true;
    }
}

// Get work item description for the active time slice
function getActiveWorkItemDescription(): string {
    try {
        const db = getDatabase();
        const result = db.prepare(`
            SELECT wi.description, wi.jira_key 
            FROM time_slices ts 
            JOIN work_items wi ON ts.work_item_id = wi.id 
            WHERE ts.end_time IS NULL 
            LIMIT 1
        `).get() as { description: string; jira_key: string | null } | undefined;
        if (result) {
            return result.jira_key ? `${result.jira_key} - ${result.description}` : result.description;
        }
        return 'Unknown task';
    } catch {
        return 'Unknown task';
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
        // Capture values for the click handler closure
        const capturedAwayStartTime = awayStartTime;
        const capturedAwayDurationSeconds = awayDurationSeconds;

        // Get work item description for notification
        const workItemDescription = getActiveWorkItemDescription();
        const soundEnabled = await isSoundEnabled();

        // Format duration for notification
        const minutes = Math.floor(awayDurationSeconds / 60);
        const durationText = minutes > 0 ? `${minutes}m` : `${awayDurationSeconds}s`;

        // Show system notification
        const notification = new Notification({
            title: 'You Were Away',
            body: `Away for ${durationText} from "${workItemDescription}". Click to handle.`,
            silent: !soundEnabled
        });

        notification.on('click', () => {
            if (mainWindow && capturedAwayStartTime) {
                mainWindow.show();
                mainWindow.focus();
                // Send the event to open the dialog
                mainWindow.webContents.send('away:detected', {
                    awayStartTime: capturedAwayStartTime.toISOString(),
                    awayDurationSeconds: capturedAwayDurationSeconds
                });
            }
        });

        notification.show();
        console.log('[AwayDetector] Showed notification for away time');

        // Also send to renderer in case user is already looking at the app
        mainWindow.webContents.send('away:detected', {
            awayStartTime: capturedAwayStartTime.toISOString(),
            awayDurationSeconds: capturedAwayDurationSeconds
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

// Update heartbeat in settings
async function updateHeartbeat() {
    try {
        const db = getDatabase();
        const now = Math.floor(Date.now() / 1000);
        db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
            .run('last_heartbeat', String(now), now);
    } catch (err) {
        console.error('[AwayDetector] Failed to update heartbeat:', err);
    }
}

// Get last heartbeat from settings
async function getLastHeartbeat(): Promise<number | null> {
    try {
        const db = getDatabase();
        const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('last_heartbeat') as { value: string } | undefined;
        return result ? parseInt(result.value, 10) : null;
    } catch {
        return null;
    }
}

// Check for away time on startup
async function checkAwayOnStartup() {
    const isTracking = checkTrackingActive();
    if (!isTracking) {
        console.log('[AwayDetector] Startup: No active tracking, skipping check');
        return;
    }

    const lastHeartbeat = await getLastHeartbeat();
    if (!lastHeartbeat) {
        console.log('[AwayDetector] Startup: No last heartbeat found, skipping check');
        return;
    }

    const lastHeartbeatDate = new Date(lastHeartbeat * 1000);
    const now = new Date();
    const gapSeconds = Math.floor((now.getTime() - lastHeartbeatDate.getTime()) / 1000);
    const thresholdSeconds = await getThresholdSeconds();

    console.log(`[AwayDetector] Startup check: Gap is ${gapSeconds}s (threshold: ${thresholdSeconds}s)`);

    if (gapSeconds >= thresholdSeconds && mainWindow) {
        console.log('[AwayDetector] Startup: Gap exceeds threshold, triggering away detection');

        // Wait for renderer to be ready before sending
        // The App component in the renderer might not have attached the listener yet
        // if we send immediately after initializeAwayDetector.
        // We can check if webContents is loading or just use a small delay/did-finish-load listener.
        const sendStartupAway = () => {
            if (mainWindow) {
                mainWindow.webContents.send('away:detected', {
                    awayStartTime: lastHeartbeatDate.toISOString(),
                    awayDurationSeconds: gapSeconds
                });
                console.log('[AwayDetector] Startup: Sent away:detected to renderer');
            }
        };

        if (mainWindow.webContents.isLoading()) {
            mainWindow.webContents.once('did-finish-load', sendStartupAway);
        } else {
            // Small delay to ensure React effects have run
            setTimeout(sendStartupAway, 3000);
        }
    }
}

export async function initializeAwayDetector(win: BrowserWindow) {
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

    // Run startup check BEFORE starting new heartbeats so we don't overwrite the last one
    await checkAwayOnStartup();

    // Start heartbeat interval (every 1 minute)
    setInterval(updateHeartbeat, 60000);
    updateHeartbeat(); // Initial heartbeat
    console.log('[AwayDetector] Started heartbeat interval (1m)');

    // Start idle check polling (every 5 seconds for responsive detection)
    setInterval(checkIdleState, 5000);

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
