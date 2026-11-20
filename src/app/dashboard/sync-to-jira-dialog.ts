import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { LucideCircleAlert, LucideCircleCheck, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { format } from 'date-fns';
import type { TimeSlice } from '@/lib/api';
import { classifySyncToJiraSlices, createSyncToJiraEntries, type SyncToJiraEntry } from '@/lib/sync-to-jira-payload';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';
import { sliceSeconds } from '../shared/duration.pipe';

@Component({
    imports: [MatDialogModule, MatSlideToggle, LucideCircleAlert, LucideCircleCheck, LucideTriangleAlert, LucideX],
    templateUrl: './sync-to-jira-dialog.html',
    styles: ['mat-dialog-content { padding-top:6px !important; max-height:75vh; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyncToJiraDialog {
    private readonly api = inject(DESKTOP_API);
    protected readonly dialog = inject<MatDialogRef<SyncToJiraDialog, boolean>>(MatDialogRef);
    private readonly data = inject<{ slices: TimeSlice[]; day: Date }>(MAT_DIALOG_DATA);
    private readonly slices = this.data.slices;
    protected readonly date = format(this.data.day, 'MMMM do, yyyy');
    protected readonly combine = signal(false);
    protected readonly classification = classifySyncToJiraSlices(this.slices);
    protected readonly skipped = [
        { reason: 'No Jira Connection', slices: this.classification.skippedConnection },
        { reason: 'Jira Connection Disabled', slices: this.classification.skippedDisabledConnection },
        { reason: '', slices: this.classification.skippedKey }
    ].flatMap(group => group.slices.map(slice => ({ reason: group.reason, slice })));
    protected readonly entries = computed(() => {
        const { syncable } = this.classification;
        const combineSameTicket = this.combine();
        if (!combineSameTicket) return createSyncToJiraEntries(syncable, { combineSameTicket });
        const ids = new Set(syncable.map(slice => slice.id));
        const linked = new Set(syncable.filter(slice => slice.jira_worklog_id)
            .map(slice => slice.jira_connection_id + ':' + slice.jira_worklog_id));
        return createSyncToJiraEntries(this.slices.filter(slice => slice.end_time && (
            ids.has(slice.id) || linked.has(slice.jira_connection_id + ':' + slice.jira_worklog_id)
        )), { combineSameTicket });
    });
    protected readonly busy = signal(false);
    protected readonly count = computed(() => this.entries().reduce((sum, entry) => sum + entry.slices.length, 0));
    protected readonly estimate = computed(() => Math.ceil(this.entries().length * 1.5));
    protected readonly progress = signal('');
    protected readonly result = signal<{ success: number; slices: number; failed: string[] } | null>(null);

    protected duration(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
    }

    protected sliceDuration(slice: TimeSlice): string { return this.duration(sliceSeconds(slice)); }

    protected async sync(): Promise<void> {
        if (this.busy() || this.result() || this.classification.activeSlice) return;
        this.busy.set(true);
        this.dialog.disableClose = true;
        const outcome = { success: 0, slices: 0, failed: [] as string[] };
        try {
            for (const entry of this.entries()) {
                this.progress.set('Syncing ' + entry.jiraKey + '…');
                try {
                    await this.syncEntry(entry);
                    outcome.success++;
                    outcome.slices += entry.slices.length;
                } catch (error) {
                    outcome.failed.push(entry.jiraKey + ' · ' + errorMessage(error));
                }
            }
            this.result.set(outcome);
        } finally {
            this.dialog.disableClose = false;
            this.busy.set(false);
        }
    }

    private async syncEntry(entry: SyncToJiraEntry): Promise<void> {
        const { timeSpentSeconds, comment, started } = entry;
        const payload = { timeSpentSeconds, comment, started };
        const connectionId = entry.slices[0].jira_connection_id ?? undefined;
        const create = () => this.api.addJiraWorklog(entry.jiraKey, payload, connectionId);
        const worklog = await (entry.jiraWorklogId
            ? this.api.updateJiraWorklog(entry.jiraKey, entry.jiraWorklogId, payload, connectionId).catch((error: unknown) => {
                if (/\b404\b/.test(errorMessage(error))) return create();
                throw error;
            })
            : create());
        await this.api.changeTimeSlices(entry.slices.map(slice => ({
            id: slice.id, synced_to_jira: 1, jira_worklog_id: worklog.id,
            synced_start_time: slice.start_time, synced_end_time: slice.end_time, synced_notes: slice.notes
        })));
    }
}
