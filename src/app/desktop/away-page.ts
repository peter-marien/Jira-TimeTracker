import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LucideArrowRight, LucideClock, LucideDownload, LucidePlus, LucideTrash2, LucideX } from '@lucide/angular';
import type { WorkItem } from '@/lib/api';
import { DESKTOP_API, DESKTOP_IPC, DesktopSettings, errorMessage } from '../core/desktop.service';
import type { AwayAction } from '../core/tracking.service';
import { DurationPipe } from '../shared/duration.pipe';
import { WorkItemPicker } from '../shared/work-item-picker';
import { JiraIssuePicker, type JiraIssue } from '../work-items/jira-issue-picker';

interface AwayData {
    awayStartTime: string;
    awayDurationSeconds: number;
    currentWorkItem: WorkItem | null;
}

@Component({
    imports: [DurationPipe, ReactiveFormsModule, WorkItemPicker, JiraIssuePicker, LucideArrowRight, LucideClock, LucideDownload, LucidePlus, LucideTrash2, LucideX],
    templateUrl: './away-page.html',
    styleUrl: './away-page.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwayPage {
    private readonly ipc = inject(DESKTOP_IPC);
    private readonly api = inject(DESKTOP_API);
    protected readonly data = signal<AwayData | null>(null);
    protected readonly action = new FormControl<AwayAction | 'import'>('keep', { nonNullable: true });
    protected readonly target = signal<WorkItem | null>(null);
    protected readonly issue = signal<JiraIssue | null>(null);
    protected readonly busy = signal(false);
    protected readonly error = signal('');

    constructor() {
        void inject(DesktopSettings).initialize();
        if (!this.ipc) return;
        inject(DestroyRef).onDestroy(this.ipc.on('away:data', (_event, data: AwayData) => {
            this.data.set(data);
            this.action.reset();
            this.target.set(null);
            this.issue.set(null);
        }));
        this.ipc.send('away-window:ready');
    }

    protected async complete(action: AwayAction | 'import'): Promise<void> {
        const data = this.data();
        if (!data || this.busy()) return;
        this.busy.set(true);
        this.error.set('');
        try {
            let targetWorkItem = this.target() ?? undefined;
            if (action === 'import') {
                const issue = this.issue();
                if (!issue) return;
                targetWorkItem = await this.api.saveWorkItem({ jira_key: issue.key, description: issue.summary || issue.key, jira_connection_id: issue.connectionId });
                action = 'reassign';
            }
            if (action === 'reassign' && !targetWorkItem) return;
            await this.api.resolveAwayTime(action, data.awayStartTime, targetWorkItem?.id);
            this.ipc.send('away:action', { action, awayStartTime: data.awayStartTime, targetWorkItem });
        } catch (error) {
            this.error.set(errorMessage(error));
        } finally {
            this.busy.set(false);
        }
    }
}
