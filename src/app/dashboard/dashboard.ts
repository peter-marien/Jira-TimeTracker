import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, linkedSignal, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideArrowLeftRight, LucidePlus, LucideWandSparkles } from '@lucide/angular';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { endOfDay, format, formatISO, isValid, parseISO, startOfDay } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import type { TimeSlice, WorkItem } from '@/lib/api';
import { roundTimeSliceBoundaries } from '@/lib/time-utils';
import { DESKTOP_API, DesktopSettings, Feedback, ViewDates, errorMessage } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { DayPicker } from '../shared/day-picker';
import { sliceSeconds } from '../shared/duration.pipe';
import { TimeSliceActions } from '../time-slices/time-slice-actions';
import { TimeSliceTable, type SliceCommand } from '../time-slices/time-slice-table';
import { WorkItemEditor, type WorkItemEditorData } from '../work-items/work-item-editor';
import { DayTimeline, type TimelineChange } from './day-timeline';
import { MergeSlicesDialog } from './merge-slices-dialog';
import { QuickStartPanel, type ConnectionHours } from './quick-start-panel';
import { SyncToJiraDialog } from './sync-to-jira-dialog';
import { TimelineConflictDialog, type TimelineResolution } from './timeline-conflict-dialog';

@Component({
    imports: [DayPicker, DayTimeline, QuickStartPanel, TimeSliceTable, LucideArrowLeftRight, LucidePlus, LucideWandSparkles],
    template: `
        <section class="p-6 space-y-6">
            <header class="flex items-center justify-between">
                <h1>Dashboard</h1>
                <div class="flex items-center gap-2">
                    <button class="legacy-button legacy-outline h-9 text-primary hover:text-primary hover:bg-primary/5" (click)="sync()"><svg lucideArrowLeftRight class="size-4 mr-2"></svg> Sync to Jira</button>
                    <app-day-picker [day]="day()" (selected)="setDay($event)" />
                </div>
            </header>
            <app-quick-start-panel [total]="total()" [goal]="goal()" [totals]="connectionHours()" [refresh]="workItemsVersion()" (started)="start($event)" (imported)="importIssue()" />
            <app-day-timeline [day]="day()" [slices]="slices()" [connections]="connections()" [manualColor]="manualColor()"
                [interval]="interval()" [elapsed]="tracking.elapsedSeconds()" (opened)="run({action: 'edit', slice: $event})" (changed)="applyTimeline($event)" />
            <section class="space-y-4">
                <div class="flex items-center justify-between">
                    <h2>Time Slices</h2>
                    <div class="flex items-center gap-2">
                        @if (selected().length > 1) { <button class="legacy-button" (click)="merge()" [disabled]="busy()">Merge selected</button> }
                        <button class="legacy-button legacy-outline h-9" (click)="round()" [disabled]="busy() || !slices().length"><svg lucideWandSparkles class="size-4 mr-2"></svg> Round Time Slices</button>
                        <button class="legacy-button legacy-outline h-9" (click)="add()"><svg lucidePlus class="size-4 mr-2"></svg> Add Time Slice</button>
                    </div>
                </div>
                @if (daySlices.error(); as loadError) { <p class="error" role="alert">{{ message(loadError) }}</p> }
                <app-time-slice-table [slices]="slices()" [selectable]="true" [(selected)]="selected"
                    [emptyText]="daySlices.isLoading() ? 'Loading time slices…' : 'No time slices found.'"
                    [elapsed]="tracking.elapsedSeconds()" (opened)="run({action: 'edit', slice: $event})" (sliceAction)="run($event)"
                    (mergeRequested)="merge()" />
            </section>
        </section>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Dashboard {
    private readonly api = inject(DESKTOP_API);
    private readonly settings = inject(DesktopSettings);
    private readonly dates = inject(ViewDates);
    private readonly dialog = inject(MatDialog);
    private readonly actions = inject(TimeSliceActions);
    private readonly feedback = inject(Feedback);
    private readonly destroyRef = inject(DestroyRef);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly queryParams = toSignal(this.route.queryParamMap);
    protected readonly tracking = inject(TrackingService);
    protected readonly day = this.dates.day;
    protected readonly dayLabel = computed(() => format(this.day(), 'yyyy-MM-dd'));
    protected readonly selected = linkedSignal<number, number[]>({
        source: () => this.day().getTime(), computation: () => []
    });
    protected readonly busy = signal(false);
    protected readonly workItemsVersion = signal(0);
    protected readonly message = errorMessage;
    protected readonly daySlices = resource({
        params: () => ({ day: this.day(), revision: this.tracking.revision() }),
        loader: ({ params }) => this.api.getTimeSlices(formatISO(startOfDay(params.day)), formatISO(endOfDay(params.day)))
    });
    private readonly connectionList = resource({ loader: () => this.api.getJiraConnections() });
    protected readonly connections = computed(() => this.connectionList.hasValue() ? this.connectionList.value() : []);
    protected readonly slices = computed(() => this.daySlices.hasValue() ? this.daySlices.value() : []);
    protected readonly manualColor = computed(() => this.settings.values()['other_color'] || '#64748b');
    protected readonly goal = computed(() => (Number(this.settings.values()['daily_target_hours']) || 8) * 3600);
    protected readonly interval = computed(() => this.settings.values()['rounding_enabled'] === 'true'
        ? Math.max(1, Number(this.settings.values()['rounding_interval']) || 15) : 1);
    protected readonly connectionHours = computed(() => {
        const groups = new Map<number | null, ConnectionHours>();
        for (const slice of this.slices()) {
            const id = slice.jira_connection_id ?? null;
            const existing = groups.get(id) ?? { id, label: slice.connection_name || 'Other', seconds: 0,
                color: this.connections().find(connection => connection.id === id)?.color || this.manualColor() };
            existing.seconds += slice.end_time ? sliceSeconds(slice) : this.tracking.elapsedSeconds();
            groups.set(id, existing);
        }
        return [...groups.values()];
    });
    protected readonly total = computed(() => this.connectionHours().reduce((total, connection) => total + connection.seconds, 0));

    constructor() {
        effect(() => {
            const value = this.queryParams()?.get('date');
            if (!value) return;
            const date = parseISO(value);
            if (isValid(date)) this.day.set(date);
        });
        let lastActiveId: number | undefined;
        effect(() => {
            const activeId = this.tracking.activeSlice()?.id;
            const stoppedId = lastActiveId;
            lastActiveId = activeId;
            if (stoppedId && !activeId) void this.promptForNotes(stoppedId);
        });
    }

    private async promptForNotes(id: number): Promise<void> {
        try {
            const slice = await this.api.getTimeSlice(id);
            if (slice?.end_time && !this.destroyRef.destroyed) await this.actions.editor({ mode: 'edit', slice });
        } catch (error) { this.feedback.error(error); }
    }

    protected setDay(day: Date): void {
        if (!isValid(day)) return;
        this.day.set(day);
        if (this.queryParams()?.has('date')) {
            void this.router.navigate([], { relativeTo: this.route, queryParams: { date: this.dayLabel() }, queryParamsHandling: 'merge', replaceUrl: true });
        }
    }

    protected async start(item: WorkItem): Promise<void> {
        await this.mutate(async () => { await this.tracking.start(item); });
    }

    protected async add(): Promise<void> {
        if (await this.actions.editor({ mode: 'add', day: this.day() })) this.daySlices.reload();
    }

    protected async importIssue(): Promise<void> {
        const item = await firstValueFrom(this.dialog.open<WorkItemEditor, WorkItemEditorData, WorkItem>(WorkItemEditor, {
            data: { import: true }, width: '500px'
        }).afterClosed());
        if (item) this.workItemsVersion.update(version => version + 1);
    }

    protected async run(command: SliceCommand): Promise<void> {
        if (await this.actions.run(command)) {
            this.selected.update(ids => ids.filter(id => id !== command.slice.id));
            this.daySlices.reload();
        }
    }

    protected async merge(): Promise<void> {
        const matching = this.slices().filter(slice => this.selected().includes(slice.id));
        if (matching.length < 2) return;
        if (!await firstValueFrom(this.dialog.open(MergeSlicesDialog, { data: matching, width: '500px', role: 'alertdialog' }).afterClosed())) return;
        await this.mutate(async () => {
            await this.api.mergeTimeSlices(matching.map(slice => slice.id));
            this.selected.set([]);
        });
    }

    protected async round(): Promise<void> {
        const changes = this.slices().map(slice => ({ slice, rounded: roundTimeSliceBoundaries(slice, this.interval()) }))
            .filter(({ slice, rounded }) => slice.start_time !== rounded.start_time || slice.end_time !== rounded.end_time)
            .map(({ rounded }) => ({ id: rounded.id, start_time: rounded.start_time, end_time: rounded.end_time }));
        if (!changes.length) {
            this.feedback.show('Time slices already match the rounding setting.');
            return;
        }
        await this.mutate(async () => {
            await this.api.changeTimeSlices(changes);
            this.feedback.show('Rounded ' + changes.length + ' time slices.');
        });
    }

    protected async sync(): Promise<void> {
        await firstValueFrom(this.dialog.open(SyncToJiraDialog, { data: { slices: this.slices(), day: this.day() }, width: '800px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
        this.daySlices.reload();
    }

    protected async applyTimeline({ slice, start, end }: TimelineChange): Promise<void> {
        const overlaps = this.slices().filter(other => other.id !== slice.id &&
            Date.parse(other.start_time) < end && (!other.end_time || start < Date.parse(other.end_time)));
        const changes: Partial<TimeSlice>[] = [{ id: slice.id, start_time: formatISO(start), end_time: formatISO(end) }];
        if (overlaps.length > 1 || overlaps.some(other => !other.end_time)) {
            this.feedback.show('The change overlaps active tracking or multiple time slices. Edit the affected time slices first.');
            return;
        }
        const overlap = overlaps[0];
        let remove: number | undefined;
        if (overlap?.end_time) {
            const resolution = await firstValueFrom(this.dialog.open<TimelineConflictDialog, void, TimelineResolution>(TimelineConflictDialog, { width: '500px', role: 'alertdialog' }).afterClosed());
            if (!resolution) return;
            const existingStart = Date.parse(overlap.start_time);
            const existingEnd = Date.parse(overlap.end_time);
            const tailEnd = resolution === 'preserve-duration' ? end + existingEnd - Math.max(existingStart, start) : existingEnd;
            if (resolution === 'preserve-duration' && this.slices().some(other => other.id !== overlap.id && other.id !== slice.id &&
                Date.parse(other.start_time) < tailEnd && (!other.end_time || end < Date.parse(other.end_time)))) {
                this.feedback.show('The adjusted interval would overlap another time slice.');
                return;
            }
            if (existingStart < start) changes.push({ id: overlap.id, end_time: formatISO(start) });
            if (tailEnd > end) {
                changes.push({
                    id: existingStart < start ? undefined : overlap.id,
                    work_item_id: overlap.work_item_id, notes: overlap.notes, tag_ids: overlap.tag_ids,
                    start_time: formatISO(end), end_time: formatISO(tailEnd)
                });
            } else if (existingStart >= start) remove = overlap.id;
        }
        await this.mutate(() => this.api.changeTimeSlices(changes, remove));
    }

    private async mutate(action: () => Promise<void>): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        try { await action(); this.daySlices.reload(); }
        catch (error) { this.feedback.error(error); }
        finally { this.busy.set(false); }
    }
}
