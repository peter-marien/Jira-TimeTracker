import { BrowserWindow, ipcMain, powerMonitor } from 'electron';
import { formatISO } from 'date-fns';
import { getDatabase } from '../src/database/db';
import type { TimeSlice, WorkItem } from '../src/lib/api';
import type { TrackingSnapshot } from '../src/lib/tracking-state';
import { normalizeTimeSliceBoundary, roundToNearestInterval } from '../src/lib/time-utils';
import { updateTrayIcon, updateTrayTooltip } from './tray';

let revision = 0;

export function handleTrackingMutation(channel: string, listener: Parameters<typeof ipcMain.handle>[1]) {
    ipcMain.handle(channel, async (event, ...args) => {
        const result = await listener(event, ...args);
        publishTrackingState(channel);
        return result;
    });
}

export function getTrackingSnapshot(): TrackingSnapshot {
    const db = getDatabase();
    const activeSlice = db.prepare('SELECT * FROM time_slices WHERE end_time IS NULL LIMIT 1').get() as TimeSlice | undefined;
    const workItem = activeSlice ? db.prepare(`
        SELECT wi.*,
               COALESCE(SUM(strftime('%s', COALESCE(ts.end_time, 'now')) - strftime('%s', ts.start_time)), 0) as total_seconds
        FROM work_items wi
        LEFT JOIN time_slices ts ON wi.id = ts.work_item_id
        WHERE wi.id = ? GROUP BY wi.id
    `).get(activeSlice.work_item_id) as WorkItem | undefined : undefined;
    return { revision, activeSlice: activeSlice ?? null, workItem: workItem ?? null };
}

export function publishTrackingState(reason: string) {
    revision++;
    const snapshot = getTrackingSnapshot();
    const active = !!snapshot.activeSlice && !!snapshot.workItem;
    try {
        updateTrayIcon(active ? 'active' : 'idle', snapshot.workItem?.description);
        updateTrayTooltip(active ? `Tracking: ${snapshot.workItem!.description}` : 'Jira Time Tracker');
    } catch (error) {
        console.error('[Tracking] Failed to update tray', error);
    }
    for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
            try {
                window.webContents.send('tracking:state', snapshot);
            } catch (error) {
                // A renderer disappearing must not turn a saved stop into a failed command.
                console.error('[Tracking] Failed to notify window', { windowId: window.id, error });
            }
        }
    }
    console.log('[Tracking] State synchronized', { reason, revision, activeSliceId: snapshot.activeSlice?.id ?? null });
    return snapshot;
}

// The database operation runs in the main process, even if a renderer is hidden or unhealthy.
export function stopActiveTracking(): string | null {
    const db = getDatabase();
    const active = db.prepare('SELECT id FROM time_slices WHERE end_time IS NULL').all() as { id: number }[];
    if (active.length === 0) {
        publishTrackingState('stop-already-idle');
        return null;
    }
    let end = new Date();
    const enabled = db.prepare('SELECT value FROM settings WHERE key = ?').get('rounding_enabled') as { value: string } | undefined;
    if (enabled?.value === 'true') {
        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('rounding_interval') as { value: string } | undefined;
        const interval = parseInt(setting?.value ?? '15', 10);
        end = roundToNearestInterval(end, Number.isFinite(interval) && interval > 0 ? interval : 15);
    }
    const endTime = normalizeTimeSliceBoundary(formatISO(end))!;
    db.prepare('UPDATE time_slices SET end_time = ?, synced_to_jira = 0, updated_at = unixepoch() WHERE end_time IS NULL').run(endTime);
    publishTrackingState('stop');
    return endTime;
}

export function initializeTrackingState() {
    ipcMain.handle('tracking:get-state', () => getTrackingSnapshot());
    ipcMain.handle('tracking:stop', () => stopActiveTracking());
    const synchronize = (reason: string) => {
        try {
            publishTrackingState(reason);
        } catch (error) {
            console.error('[Tracking] Failed to synchronize after wake', error);
        }
    };
    powerMonitor.on('resume', () => synchronize('resume'));
    powerMonitor.on('unlock-screen', () => synchronize('unlock-screen'));
    publishTrackingState('startup');
}
