import { DatePipe } from '@angular/common';
import { CdkMenuModule } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { LucideArrowRightLeft, LucideCircleAlert, LucideCircleCheck, LucideCopy, LucideEllipsis, LucideExternalLink, LucideFilePen, LucideMerge, LucideMoveRight, LucidePencil, LucidePlay, LucideSplit, LucideSquareSplitHorizontal, LucideTrash2, LucideX } from '@lucide/angular';
import type { TimeSlice } from '@/lib/api';
import { elapsedClock, sliceSeconds } from '../shared/duration.pipe';
import { isRowControl, selectedRows } from '../shared/row-selection';
import { actionMenuPositions } from '../shared/action-menu';

export type SliceAction = 'edit' | 'split' | 'copy' | 'move' | 'delete' | 'resume' | 'stop' | 'jira' | 'workItem';
export interface SliceCommand { action: SliceAction; slice: TimeSlice }

@Component({
    selector: 'app-time-slice-table',
    imports: [DatePipe, CdkMenuModule, LucideArrowRightLeft, LucideCircleAlert, LucideCircleCheck, LucideCopy, LucideEllipsis,
        LucideExternalLink, LucideFilePen, LucideMerge, LucideMoveRight, LucidePencil, LucidePlay, LucideSplit, LucideSquareSplitHorizontal, LucideTrash2, LucideX],
    templateUrl: './time-slice-table.html',
    styles: ['table { table-layout: fixed; } th, td { padding: 16px; } th { font-size: 14px; font-weight: 500; } td { border: 0; } tbody tr + tr { border-top: 1px solid hsl(var(--border)); } tbody tr:hover { background: hsl(var(--accent) / .5); } tbody tr.active { background: hsl(var(--primary) / .05); } tbody tr.selected { background: hsl(var(--primary) / .15); }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeSliceTable {
    readonly slices = input.required<TimeSlice[]>();
    readonly showDate = input(false);
    readonly selectable = input(false);
    readonly elapsed = input(0);
    readonly emptyText = input('No time slices found.');
    readonly selected = model<number[]>([]);
    readonly sliceAction = output<SliceCommand>();
    readonly opened = output<TimeSlice>();
    readonly mergeRequested = output<void>();
    protected readonly menuPositions = actionMenuPositions;
    protected readonly duration = sliceSeconds;
    protected readonly clock = elapsedClock;
    protected readonly ordered = computed(() => [...this.slices()].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time)));
    private anchor: number | null = null;

    protected selectRow(event: MouseEvent, id: number): void {
        if (!this.selectable() || isRowControl(event)) return;
        this.selected.update(ids => selectedRows(this.ordered().map(slice => slice.id), ids, this.anchor, id, event));
        this.anchor = id;
    }

    protected open(event: MouseEvent, slice: TimeSlice): void {
        if (!isRowControl(event)) this.opened.emit(slice);
    }

    protected run(action: SliceAction, slice: TimeSlice): void {
        this.sliceAction.emit({ action, slice });
    }
}
