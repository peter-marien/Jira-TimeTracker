import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { addDays, format, setHours, startOfDay } from 'date-fns';
import type { JiraConnection, TimeSlice } from '@/lib/api';
import { roundToNearestInterval } from '@/lib/time-utils';
import { HoverTooltip } from '../shared/hover-tooltip';

type DragMode = 'move' | 'start' | 'end';
export interface TimelineChange { slice: TimeSlice; start: number; end: number }

interface Drag extends TimelineChange {
    pointer: number;
    origin: number;
    width: number;
    mode: DragMode;
}

const hour = 60 * 60 * 1000;

@Component({
    selector: 'app-day-timeline',
    imports: [HoverTooltip],
    template: `
        <section aria-label="Day timeline">
            <div #track class="track"
                (pointermove)="move($event)" (pointerup)="finish($event)" (pointercancel)="drag.set(null)"
                (lostpointercapture)="drag.set(null)">
                <div class="ticks" aria-hidden="true">
                    @for (tick of ticks(); track $index) {
                        <div class="mark" [style.left.%]="$index / (ticks().length - 1) * 100"><span>{{ tick }}</span></div>
                    }
                </div>
                @for (slice of slices(); track slice.id) {
                    <div class="slice" [class.tracking]="!slice.end_time" [style.left.%]="left(slice)" [style.width.%]="width(slice)" [style.--slice-color]="color(slice)"
                        [appHoverTooltip]="hint">
                        @if (slice.end_time) {
                            <span class="handle start" (pointerdown)="begin($event, slice, 'start', track)"></span>
                        }
                        <button type="button" (pointerdown)="begin($event, slice, 'move', track)" (click)="open($event, slice)"
                            [attr.aria-label]="title(slice)">
                            {{ slice.jira_key || 'Manual' }}
                        </button>
                        @if (slice.end_time) {
                            <span class="handle end" (pointerdown)="begin($event, slice, 'end', track)"></span>
                        }
                    </div>
                    <ng-template #hint>
                        <div class="legacy-popover max-w-[400px] overflow-hidden text-xs text-left">
                            <div class="bg-muted/50 px-3 py-2 border-b border-border font-medium">
                                <div class="font-semibold">{{ tooltipDate(slice) }}</div>
                                @if (slice.jira_key || slice.work_item_description) {
                                    <div class="flex gap-2 items-baseline mt-0.5">
                                        @if (slice.jira_key) { <span class="font-mono font-bold text-primary whitespace-nowrap shrink-0">{{ slice.jira_key }}</span> }
                                        @if (slice.work_item_description) { <span class="text-muted-foreground truncate">{{ slice.work_item_description }}</span> }
                                    </div>
                                }
                            </div>
                            <div class="p-3 bg-popover leading-tight flex gap-3">
                                <span class="font-mono text-muted-foreground shrink-0 tabular-nums opacity-80">{{ timeRange(slice) }}:</span>
                                <span class="wrap-break-word">{{ slice.notes || '' }}@if (!slice.notes) { <span class="italic opacity-50">No notes</span> }</span>
                            </div>
                        </div>
                    </ng-template>
                }
            </div>
        </section>
    `,
    styleUrl: './day-timeline.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DayTimeline {
    readonly day = input.required<Date>();
    readonly slices = input.required<TimeSlice[]>();
    readonly connections = input.required<JiraConnection[]>();
    readonly manualColor = input('#64748b');
    readonly interval = input(1);
    readonly elapsed = input(0);
    readonly opened = output<TimeSlice>();
    readonly changed = output<TimelineChange>();
    protected readonly drag = signal<Drag | null>(null);
    private suppressClick = false;
    private readonly range = computed(() => {
        const day = startOfDay(this.day());
        const first = day.getTime();
        const last = startOfDay(addDays(day, 1)).getTime();
        const slices = this.slices();
        let from = setHours(day, 7).getTime();
        let to = setHours(day, 19).getTime();
        if (slices.length) {
            const earliest = Math.min(...slices.map(slice => Date.parse(slice.start_time)));
            const latest = Math.max(...slices.map(slice => slice.end_time ? Date.parse(slice.end_time) : Date.now()));
            const padding = Math.max(hour / 2, (10 * hour - (latest - earliest)) / 2);
            from = first + Math.max(0, Math.floor((earliest - padding - first) / hour)) * hour;
            to = Math.min(last, first + Math.ceil((latest + padding - first) / hour) * hour);
        }
        return { from, to, span: to - from, first, last };
    });
    protected readonly ticks = computed(() => {
        const { from, to, span } = this.range();
        const intervals = Math.max(1, Math.round(span / hour));
        return Array.from({ length: intervals + 1 }, (_, index) => {
            const time = index === intervals ? to : from + index * span / intervals;
            return format(time, 'HH:mm');
        });
    });

    private boundaries(slice: TimeSlice) {
        const drag = this.drag();
        if (drag?.slice.id === slice.id) return drag;
        const start = Date.parse(slice.start_time);
        return { start, end: slice.end_time ? Date.parse(slice.end_time) : start + this.elapsed() * 1000 };
    }

    protected left(slice: TimeSlice): number {
        return Math.max(0, Math.min(99, (this.boundaries(slice).start - this.range().from) / this.range().span * 100));
    }

    protected width(slice: TimeSlice): number {
        return Math.max(0, Math.min(100 - this.left(slice), (this.boundaries(slice).end - this.boundaries(slice).start) / this.range().span * 100));
    }

    protected color(slice: TimeSlice): string {
        return this.connections().find(connection => connection.id === slice.jira_connection_id)?.color || this.manualColor();
    }

    protected title(slice: TimeSlice): string {
        return [slice.jira_key, slice.work_item_description, format(new Date(slice.start_time), 'HH:mm'),
            slice.end_time ? format(new Date(slice.end_time), 'HH:mm') : 'Tracking'].filter(Boolean).join(' · ');
    }

    protected tooltipDate(slice: TimeSlice): string { return format(this.boundaries(slice).start, 'MMM d, yyyy'); }

    protected timeRange(slice: TimeSlice): string {
        const { start, end } = this.boundaries(slice);
        return format(start, 'HH:mm') + ' - ' + (slice.end_time ? format(end, 'HH:mm') : 'Now');
    }

    protected begin(event: PointerEvent, slice: TimeSlice, mode: DragMode, track: HTMLElement): void {
        if (!slice.end_time || event.button !== 0) return;
        this.suppressClick = false;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        this.drag.set({ slice, pointer: event.pointerId, mode, origin: event.clientX, width: track.clientWidth,
            start: Date.parse(slice.start_time), end: Date.parse(slice.end_time) });
    }

    protected move(event: PointerEvent): void {
        const drag = this.drag();
        if (!drag || drag.pointer !== event.pointerId || !drag.width) return;
        const delta = event.clientX - drag.origin;
        if (Math.abs(delta) < 3 && !this.suppressClick) return;
        this.suppressClick = true;
        const offset = delta / drag.width * this.range().span;
        const originalStart = Date.parse(drag.slice.start_time);
        const originalEnd = Date.parse(drag.slice.end_time!);
        const rounded = (time: number) => roundToNearestInterval(new Date(time), this.interval()).getTime();
        const start = drag.mode === 'end' ? originalStart : rounded(originalStart + offset);
        const end = drag.mode === 'start' ? originalEnd : drag.mode === 'move' ? start + originalEnd - originalStart : rounded(originalEnd + offset);
        if (start >= this.range().first && end > start && (end <= this.range().last || end <= originalEnd)) this.drag.set({ ...drag, start, end });
    }

    protected finish(event: PointerEvent): void {
        const drag = this.drag();
        if (!drag || event.pointerId !== drag.pointer) return;
        this.drag.set(null);
        if (drag.start !== Date.parse(drag.slice.start_time) || drag.end !== Date.parse(drag.slice.end_time!)) this.changed.emit(drag);
    }

    protected open(event: MouseEvent, slice: TimeSlice): void {
        if (!this.suppressClick || event.detail === 0) this.opened.emit(slice);
        this.suppressClick = false;
    }
}
