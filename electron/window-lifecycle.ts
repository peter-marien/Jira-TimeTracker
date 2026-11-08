import { app, BrowserWindow, dialog, powerMonitor, screen } from 'electron';
import type { Rectangle } from 'electron';

export function ensureWindowOnScreen(window: BrowserWindow) {
    if (window.isDestroyed()) return;
    const bounds = window.getBounds();
    const displays = screen.getAllDisplays();
    const accessible = displays.some(({ workArea }) => {
        const horizontalOverlap = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x);
        return horizontalOverlap >= Math.min(120, bounds.width)
            && bounds.y >= workArea.y && bounds.y + 32 <= workArea.y + workArea.height;
    });
    if (accessible) return;
    const area = screen.getPrimaryDisplay().workArea;
    const width = Math.min(bounds.width, area.width);
    const height = Math.min(bounds.height, area.height);
    const safe: Rectangle = {
        width,
        height,
        x: area.x + Math.floor((area.width - width) / 2),
        y: area.y + Math.floor((area.height - height) / 2)
    };
    window.setBounds(safe);
}

export function revealWindow(window: BrowserWindow) {
    if (window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    ensureWindowOnScreen(window);
    window.show();
    window.focus();
}

export function installWindowRecovery(window: BrowserWindow, name: string) {
    let quitting = false;
    let prompting = false;
    let recoveryTimes: number[] = [];
    let wakeTimer: ReturnType<typeof setTimeout> | undefined;
    const onQuit = () => { quitting = true; };
    app.on('before-quit', onQuit);

    const diagnose = (event: string) => {
        if (window.isDestroyed()) return;
        console.log('[Window] State', {
            name, event, id: window.id,
            visible: window.isVisible(), minimized: window.isMinimized(),
            bounds: window.getBounds(), loading: window.webContents.isLoading()
        });
    };
    const recover = () => {
        if (quitting || window.isDestroyed() || window.webContents.isDestroyed()) return;
        const now = Date.now();
        recoveryTimes = recoveryTimes.filter(time => now - time < 60_000);
        if (recoveryTimes.length >= 3) {
            console.error('[Window] Renderer recovery limit reached', { name });
            return;
        }
        recoveryTimes.push(now);
        console.warn('[Window] Reloading failed renderer', { name, attempt: recoveryTimes.length });
        try {
            window.webContents.reload();
        } catch (error) {
            console.error('[Window] Renderer reload failed', { name, error });
        }
    };
    window.webContents.on('render-process-gone', (_event, details) => {
        if (details.reason !== 'clean-exit') recover();
    });
    window.on('unresponsive', async () => {
        if (quitting || prompting || window.isDestroyed()) return;
        prompting = true;
        try {
            const { response } = await dialog.showMessageBox(window, {
                type: 'warning',
                title: 'Jira Time Tracker is not responding',
                message: 'Reload this window?',
                detail: 'Saved time entries are safe. Any unsaved edits in this window will be lost.',
                buttons: ['Wait', 'Reload'],
                defaultId: 0,
                cancelId: 0
            });
            if (response === 1 && !quitting && !window.isDestroyed()) {
                if (recoveryTimes.filter(time => Date.now() - time < 60_000).length >= 3) {
                    console.error('[Window] Renderer recovery limit reached', { name });
                    return;
                }
                // Reloading a hung renderer needs a fresh process. Its termination event triggers recovery.
                window.webContents.forcefullyCrashRenderer();
            }
        } catch (error) {
            console.error('[Window] Failed to recover unresponsive window', { name, error });
        } finally {
            prompting = false;
        }
    });
    const reposition = () => {
        if (quitting || window.isDestroyed()) return;
        ensureWindowOnScreen(window);
        diagnose('display-changed');
    };
    const onResume = () => {
        diagnose('resume');
        clearTimeout(wakeTimer);
        // Displays can become available shortly after Windows sends the resume event.
        wakeTimer = setTimeout(reposition, 500);
    };
    powerMonitor.on('resume', onResume);
    screen.on('display-added', reposition);
    screen.on('display-removed', reposition);
    screen.on('display-metrics-changed', reposition);
    window.on('show', () => diagnose('show'));
    window.on('hide', () => diagnose('hide'));
    window.on('minimize', () => diagnose('minimize'));
    window.on('restore', () => diagnose('restore'));
    window.once('closed', () => {
        clearTimeout(wakeTimer);
        app.removeListener('before-quit', onQuit);
        powerMonitor.removeListener('resume', onResume);
        screen.removeListener('display-added', reposition);
        screen.removeListener('display-removed', reposition);
        screen.removeListener('display-metrics-changed', reposition);
    });
}
