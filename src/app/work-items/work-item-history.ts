import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { LucideLoaderCircle, LucideX } from '@lucide/angular';
import { Router } from '@angular/router';
import { format } from 'date-fns';
import type { TimeSlice, WorkItem } from '@/lib/api';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { TimeSliceActions } from '../time-slices/time-slice-actions';
import { TimeSliceTable, type SliceCommand } from '../time-slices/time-slice-table';

@Component({
    imports: [MatDialogModule, TimeSliceTable, LucideLoaderCircle, LucideX],
    template: `
        <h2 mat-dialog-title>Time Slices for Work Item</h2>
        <button type="button" class="dialog-close" aria-label="Close" mat-dialog-close><svg lucideX class="size-4"></svg></button>
        <mat-dialog-content>
            <p class="legacy-dialog-description mb-8">{{ item.jira_key ? '[' + item.jira_key + '] ' : '' }}{{ item.description }}</p>
            @if (history.error(); as failure) { <p class="error" role="alert">{{ message(failure) }}</p> }
            @else if (history.isLoading()) { <p class="grid h-40 place-items-center" role="status" aria-label="Loading time slices"><svg lucideLoaderCircle class="size-8 animate-spin text-muted-foreground"></svg></p> }
            @else if (history.value()?.length) {
                <app-time-slice-table [slices]="history.value() ?? []" [showDate]="true" [elapsed]="tracking.elapsedSeconds()"
                    (sliceAction)="run($event)" (opened)="openDay($event)" />
            } @else {
                <p class="grid h-40 place-items-center text-muted-foreground border">No time slices recorded yet.</p>
            }
        </mat-dialog-content>
    `,
    styles: ['mat-dialog-content { padding-top:6px !important; max-height:none; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkItemHistory {
    protected readonly item = inject<WorkItem>(MAT_DIALOG_DATA);
    protected readonly tracking = inject(TrackingService);
    protected readonly message = errorMessage;
    private readonly api = inject(DESKTOP_API);
    private readonly router = inject(Router);
    private readonly dialog = inject(MatDialogRef<WorkItemHistory>);
    private readonly actions = inject(TimeSliceActions);
    protected readonly history = resource({
        params: () => this.tracking.revision(),
        loader: () => this.api.getTimeSlicesForWorkItem(this.item.id)
    });

    protected async run(command: SliceCommand): Promise<void> {
        if (await this.actions.run(command)) this.history.reload();
    }

    protected openDay(slice: TimeSlice): void {
        this.dialog.close();
        void this.router.navigate(['/'], { queryParams: { date: format(new Date(slice.start_time), 'yyyy-MM-dd') } });
    }
}
