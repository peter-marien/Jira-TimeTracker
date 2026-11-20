import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { LucideClock, LucideInfo } from '@lucide/angular';
import { format } from 'date-fns';
import type { TimeSlice } from '@/lib/api';

@Component({
    imports: [MatDialogModule, LucideClock, LucideInfo],
    template: `
        <h2 mat-dialog-title>{{ blocked ? 'Cannot Merge Slices' : 'Merge Time Slices?' }}</h2>
        <mat-dialog-content>
            @if (blocked) {
                <div class="flex gap-3 items-start p-3 border border-destructive/20 bg-destructive/10 text-destructive">
                    <svg lucideInfo class="size-5 mt-0.5 shrink-0"></svg>
                    <div>
                        <strong>{{ differentItems ? 'Different Work Items' : 'Synced Slices Selected' }}</strong>
                        <p class="opacity-90">{{ differentItems ? 'All selected slices must belong to the same work item to be merged.' : 'Slices that have already been synced to Jira cannot be merged.' }}</p>
                    </div>
                </div>
            } @else {
                <div class="space-y-4 text-foreground/90">
                    <p>You are about to merge {{ slices.length }} time slices into one.</p>
                    <div class="bg-muted p-4 rounded-lg space-y-3 border">
                        <div class="space-y-1">
                            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Time Range</p>
                            <div class="flex items-center gap-2 font-mono text-sm font-medium"><svg lucideClock class="size-3.5 text-primary"></svg>{{ startTime }} <span class="text-muted-foreground">→</span> {{ endTime }}</div>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Work Item</p>
                            <p class="text-sm font-medium">{{ first.work_item_description }}</p>
                            @if (first.jira_key) { <span class="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5">{{ first.jira_key }}</span> }
                        </div>
                        <div class="pt-2 border-t border-border/50"><p class="text-xs italic text-muted-foreground">Notes from all slices will be concatenated.</p></div>
                    </div>
                </div>
            }
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button class="legacy-button legacy-outline h-10 px-4" mat-dialog-close cdkFocusInitial>Close</button>
            @if (!blocked) { <button class="legacy-button legacy-primary h-10 px-4" [mat-dialog-close]="true">Merge Slices</button> }
        </mat-dialog-actions>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MergeSlicesDialog {
    protected readonly slices = inject<TimeSlice[]>(MAT_DIALOG_DATA);
    protected readonly first = this.slices[0];
    protected readonly differentItems = this.slices.some(slice => slice.work_item_id !== this.first.work_item_id);
    protected readonly blocked = this.differentItems || this.slices.some(slice => !!slice.synced_to_jira);
    protected readonly startTime = format(Math.min(...this.slices.map(slice => Date.parse(slice.start_time))), 'HH:mm:ss');
    protected readonly endTime = this.slices.some(slice => !slice.end_time) ? 'Now'
        : format(Math.max(...this.slices.map(slice => Date.parse(slice.end_time!))), 'HH:mm:ss');
}
