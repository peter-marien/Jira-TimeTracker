import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideClock, LucidePlus, LucideTrash2, LucideX } from '@lucide/angular';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators, type FormControl, type FormGroup } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { format, formatISO, parseISO, startOfMinute } from 'date-fns';
import { formatDuration } from '@/lib/time-utils';
import type { Tag, TimeSlice, WorkItem } from '@/lib/api';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';
import { WorkItemPicker } from '../shared/work-item-picker';
import { DayPicker } from '../shared/day-picker';
import { CalendarGrid } from '../shared/calendar-grid';
import { ClockInput } from '../shared/clock-input';
import { TagPicker } from './tag-picker';

export type TimeSliceEditorData =
    | { mode: 'add'; day: Date }
    | { mode: 'edit' | 'move' | 'copy' | 'split'; slice: TimeSlice };

const titles = { add: 'Add Time Slice', edit: 'Edit Time Slice', move: 'Move Time Slice', copy: 'Copy Time Slice', split: 'Advanced Split' };
type SegmentForm = FormGroup<{ start: FormControl<string>; end: FormControl<string>; itemId: FormControl<number> }>;

@Component({
    imports: [ReactiveFormsModule, MatSlideToggle, MatDialogModule, WorkItemPicker, DayPicker, CalendarGrid, ClockInput, TagPicker, LucideClock, LucidePlus, LucideTrash2, LucideX],
    templateUrl: './time-slice-editor.html',
    styles: [`
        mat-dialog-content { padding-top:0 !important; }
        .secondary-description { padding-top:6px; }
        .has-calendar, .split-form { gap:24px; }
        .split-form { padding-right:16px; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeSliceEditor {
    private readonly api = inject(DESKTOP_API);
    private readonly builder = inject(NonNullableFormBuilder);
    private readonly dialog = inject<MatDialogRef<TimeSliceEditor, boolean>>(MatDialogRef);
    protected readonly data = inject<TimeSliceEditorData>(MAT_DIALOG_DATA);
    protected readonly title = titles[this.data.mode];
    protected readonly description = {
        add: this.data.mode === 'add' ? 'Manually add a time entry for ' + format(this.data.day, 'M/d/yyyy') + '.' : '',
        edit: 'Modify date, start/end times or notes.',
        move: 'Reassign this time slice to a different work item.',
        copy: 'Select one or more days to copy this time entry to.',
        split: 'Extract one or more segments from this time slice. Unassigned time stays on the original work item.'
    }[this.data.mode];
    protected readonly item = signal<WorkItem | null>(null);
    protected readonly tags = signal<Tag[]>([]);
    protected readonly tagIds = signal(this.source?.tag_ids ?? this.source?.tags?.map(tag => tag.id) ?? []);
    protected readonly dates = signal<string[]>([]);
    protected readonly copyMonth = signal(this.source ? new Date(this.source.start_time) : new Date());
    protected readonly error = signal('');
    protected readonly busy = signal(false);
    protected readonly form = this.builder.group({
        start: [this.initialStart(), Validators.required],
        end: this.source?.end_time ? localDateTime(this.source.end_time) : '',
        notes: this.source?.notes ?? '',
        includeNotes: true,
        segments: this.builder.array<SegmentForm>([])
    });

    private readonly startValue = toSignal(this.form.controls.start.valueChanges, { initialValue: this.form.controls.start.value });
    protected readonly endValue = toSignal(this.form.controls.end.valueChanges, { initialValue: this.form.controls.end.value });
    protected readonly startDate = computed(() => parseISO(this.startValue()));
    protected readonly endDate = computed(() => this.endValue() ? parseISO(this.endValue()) : this.startDate());
    protected readonly durationLabel = computed(() => {
        if (!this.endValue()) return '';
        const seconds = (this.endDate().getTime() - this.startDate().getTime()) / 1000;
        return seconds > 0 ? formatDuration(seconds) : 'Invalid duration';
    });

    protected setBoundary(boundary: 'start' | 'end', date: Date): void {
        this.form.controls[boundary].setValue(localDateTime(date));
        this.error.set('');
    }

    protected get source(): TimeSlice | undefined {
        return this.data.mode === 'add' ? undefined : this.data.slice;
    }

    constructor() {
        if (this.data.mode === 'split') this.addSegment();
        if (this.data.mode === 'add' || this.data.mode === 'edit') {
            void this.api.getTags().then(tags => this.tags.set(tags)).catch(error => this.error.set(errorMessage(error)));
        }
    }

    private initialStart(): string {
        if (this.data.mode !== 'add') return localDateTime(this.data.slice.start_time);
        const now = new Date();
        const start = new Date(this.data.day);
        start.setHours(now.getHours(), now.getMinutes(), 0, 0);
        return localDateTime(start);
    }

    protected addSegment(): void {
        const segments = this.form.controls.segments;
        const last = segments.controls.at(-1);
        if (last) {
            const boundary = last.controls.end.value || last.controls.start.value;
            segments.push(this.builder.group({ start: boundary, end: boundary, itemId: 0 }));
            return;
        }
        const start = Date.parse(this.source!.start_time);
        const end = this.source?.end_time ? Date.parse(this.source.end_time) : Date.now();
        const minutes = Math.max(0, Math.floor((end - start) / 60000));
        const middle = start + Math.max(0, minutes / 2 - 5) * 60000;
        segments.push(this.builder.group({
            start: localDateTime(new Date(middle)), end: localDateTime(new Date(middle + Math.min(minutes, 10) * 60000)), itemId: 0
        }));
    }

    protected setSegmentTime(control: FormControl<string>, time: string): void {
        const date = (control.value || this.initialStart()).slice(0, 10);
        control.setValue(time ? date + 'T' + time : '');
    }

    protected toggleDate(date: Date): void {
        const key = format(date, 'yyyy-MM-dd');
        this.dates.update(dates => dates.includes(key) ? dates.filter(value => value !== key) : [...dates, key].sort());
    }

    protected toggleTag(id: number, checked: boolean): void {
        this.tagIds.update(ids => checked ? [...ids, id] : ids.filter(value => value !== id));
    }

    protected async save(): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        this.error.set('');
        try {
            const value = this.form.getRawValue();
            switch (this.data.mode) {
                case 'move': {
                    const item = this.item();
                    if (!item) throw new Error('Select a work item.');
                    if (item.id !== this.data.slice.work_item_id) {
                        await this.api.saveTimeSlice({ id: this.data.slice.id, work_item_id: item.id, synced_to_jira: 0, jira_worklog_id: null });
                    }
                    break;
                }
                case 'copy': {
                    if (!this.dates().length) throw new Error('Add at least one date.');
                    const source = this.data.slice;
                    if (!source.end_time) throw new Error('Stop tracking before copying this time slice.');
                    const offset = Math.round((Date.parse(source.end_time) - Date.parse(source.start_time)) / 60000);
                    const copies = this.dates().map(date => {
                        const start = new Date(date + 'T' + format(new Date(source.start_time), 'HH:mm'));
                        return {
                            work_item_id: source.work_item_id, start_time: formatISO(start),
                            end_time: formatISO(new Date(start.getTime() + offset * 60000)),
                            notes: value.includeNotes ? source.notes : null, tag_ids: this.tagIds()
                        };
                    });
                    await this.api.changeTimeSlices(copies);
                    break;
                }
                case 'split':
                    await this.api.changeTimeSlices(this.split(this.data.slice, value.segments), this.data.slice.id);
                    break;
                default: {
                    const sourceStart = this.source?.start_time;
                    const sourceEnd = this.source?.end_time;
                    const start = new Date(sourceStart && localDateTime(sourceStart) === value.start ? sourceStart : value.start);
                    const end = value.end ? new Date(sourceEnd && localDateTime(sourceEnd) === value.end ? sourceEnd : value.end) : null;
                    const itemId = this.source?.work_item_id ?? this.item()?.id;
                    if (!itemId) throw new Error('Select a work item.');
                    if (!Number.isFinite(start.getTime()) || (end && !(end > start))) throw new Error('End must be after start.');
                    await this.api.saveTimeSlice({
                        id: this.source?.id, work_item_id: itemId, start_time: formatISO(start),
                        end_time: end ? formatISO(end) : null, notes: value.notes, tag_ids: this.tagIds()
                    });
                }
            }
            this.dialog.close(true);
        } catch (error) {
            this.error.set(errorMessage(error));
        } finally {
            this.busy.set(false);
        }
    }

    private split(source: TimeSlice, segments: { start: string; end: string; itemId: number }[]): Partial<TimeSlice>[] {
        if (!segments.length) throw new Error('Add at least one interval.');
        const result: Partial<TimeSlice>[] = [];
        const limit = source.end_time ? Date.parse(source.end_time) : startOfMinute(new Date()).getTime();
        let cursor: number | null = Date.parse(source.start_time);
        const add = (start: number, end: number | null, itemId: number, notes?: string | null) =>
            result.push({ start_time: formatISO(start), end_time: end === null ? null : formatISO(end), work_item_id: itemId, notes, tag_ids: this.tagIds() });

        for (const segment of [...segments].sort((first, second) => first.start.localeCompare(second.start))) {
            const start = Date.parse(segment.start);
            const end = segment.end ? Date.parse(segment.end) : null;
            if (!segment.itemId || cursor === null || !(start >= cursor && start <= limit) ||
                (end === null ? !!source.end_time : !(end > start && end <= limit))) {
                throw new Error('Select a work item and enter non-overlapping intervals within the original time slice.');
            }
            if (start > cursor) add(cursor, start, source.work_item_id, source.notes);
            add(start, end, segment.itemId);
            cursor = end;
        }
        if (cursor !== null && (!source.end_time || cursor < limit)) {
            add(cursor, source.end_time ? limit : null, source.work_item_id, source.notes);
        }
        return result;
    }
}

function localDateTime(value: string | Date): string {
    return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}
