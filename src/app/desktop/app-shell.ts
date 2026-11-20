import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
    LucideBriefcase, LucideCalendarDays, LucideBarChart3, LucideCircleStop, LucideClock,
    LucideCopy, LucideLayoutDashboard, LucideMinus, LucidePictureInPicture2, LucideSearch, LucideSettings,
    LucideSquare, LucideTags, LucideX
} from '@lucide/angular';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DESKTOP_API, DESKTOP_IPC, DesktopSettings, Feedback } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { confirm } from '../shared/confirm-dialog';
import { DurationPipe, elapsedClock } from '../shared/duration.pipe';

@Component({
    imports: [RouterLink, RouterLinkActive, RouterOutlet, DurationPipe, LucideBriefcase, LucideCalendarDays,
        LucideBarChart3, LucideCircleStop, LucideClock, LucideCopy, LucideLayoutDashboard,
        LucideMinus, LucidePictureInPicture2, LucideSearch, LucideSettings, LucideSquare, LucideTags, LucideX],
    templateUrl: './app-shell.html',
    styleUrl: './app-shell.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShell {
    protected readonly api = inject(DESKTOP_API);
    protected readonly settings = inject(DesktopSettings);
    protected readonly tracking = inject(TrackingService);
    private readonly ipc = inject(DESKTOP_IPC);
    private readonly router = inject(Router);
    private readonly dialog = inject(MatDialog);
    private readonly feedback = inject(Feedback);
    protected readonly clock = elapsedClock;
    protected readonly version = signal('');
    protected readonly maximized = signal(false);
    protected readonly nav = [
        { route: '/', label: 'Dashboard' }, { route: '/work-items', label: 'Work Items' },
        { route: '/tags', label: 'Tags' }, { route: '/month', label: 'Month View' },
        { route: '/search', label: 'Search' }, { route: '/reports', label: 'Reports' },
        { route: '/settings', label: 'Settings' }
    ];

    constructor() {
        void this.settings.initialize();
        if (!this.ipc) return;
        const destroyRef = inject(DestroyRef);
        const updateMaximized = () => void this.api.isWindowMaximized().then(value => this.maximized.set(value)).catch(() => undefined);
        updateMaximized();
        const timer = setInterval(updateMaximized, 500);
        destroyRef.onDestroy(() => clearInterval(timer));
        destroyRef.onDestroy(this.ipc.on('update:downloaded', (_event, data: { version: string }) => {
            void this.showUpdate(data.version);
        }));
        void this.api.getAppVersion().then(version => this.version.set(version)).catch(error => this.feedback.error(error));
        void this.promptForConnection().catch(error => this.feedback.error(error));
    }

    private async promptForConnection(): Promise<void> {
        const connections = await this.api.getJiraConnections();
        if (connections.length || this.router.url.startsWith('/settings')) return;
        if (await confirm(this.dialog, { title: 'Add Your First Jira Connection', message: 'Open Settings to connect Jira and start linking work.', action: 'Go to Connections' })) {
            await this.router.navigate(['/settings'], { queryParams: { tab: 'connections' } });
        }
    }

    private async showUpdate(version: string): Promise<void> {
        if (await confirm(this.dialog, { title: 'Update Ready', message: `Version ${version} has been downloaded. Restart to install it.`, action: 'Restart Now' })) this.api.quitAndInstallUpdate();
    }

    protected async maximize(): Promise<void> {
        try {
            if (await this.api.isWindowMaximized()) {
                this.api.unmaximizeWindow();
                this.maximized.set(false);
            } else {
                this.api.maximizeWindow();
                this.maximized.set(true);
            }
        } catch (error) {
            this.feedback.error(error);
        }
    }

    protected async stop(): Promise<void> {
        try { await this.tracking.stop(); }
        catch (error) { this.feedback.error(error); }
    }
}
