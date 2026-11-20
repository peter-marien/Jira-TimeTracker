import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { LucideCalendarDays, LucideX } from '@lucide/angular';
import { endOfDay, format, formatISO, startOfDay } from 'date-fns';
import type { JiraWorklogImportResult } from '@/lib/api';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';
import { CalendarGrid } from '../shared/calendar-grid';

@Component({
    imports: [MatDialogModule, CdkConnectedOverlay, CdkOverlayOrigin, CalendarGrid, LucideCalendarDays, LucideX],
    templateUrl: './import-worklogs-dialog.html',
    styles: ['mat-dialog-content { padding-top:6px !important; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportWorklogsDialog {
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject(MatDialogRef<ImportWorklogsDialog>);
    protected readonly message = errorMessage;
    protected readonly connections = resource({ loader: async () => (await this.api.getJiraConnections()).filter(connection => !!connection.is_enabled) });
    private readonly today = startOfDay(new Date());
    protected readonly range = signal<[Date, Date?]>([this.today, this.today]);
    protected readonly month = signal(this.today);
    protected readonly calendarOpen = signal(false);
    protected readonly selectedDays = computed(() => {
        const [from, to] = this.range();
        return to ? [format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')] : [format(from, 'yyyy-MM-dd')];
    });
    protected readonly rangeLabel = computed(() => {
        const [from, to] = this.range();
        return to ? format(from, 'PPP') + ' - ' + format(to, 'PPP') : format(from, 'PPP');
    });
    protected readonly ids = linkedSignal(() => (this.connections.value() ?? []).map(connection => connection.id));
    protected readonly connectionLabels = computed(() => {
        const connections = this.connections.value() ?? [];
        if (this.ids().length === connections.length) return 'All enabled connections';
        return connections.filter(connection => this.ids().includes(connection.id)).map(connection => connection.name).join(', ') || 'No connections selected';
    });
    protected readonly result = signal<JiraWorklogImportResult | null>(null);
    protected readonly error = signal('');
    protected readonly busy = signal(false);

    protected selectAll(): void { this.ids.set((this.connections.value() ?? []).map(connection => connection.id)); }

    protected toggle(id: number, event: Event): void {
        this.ids.update(ids => (event.target as HTMLInputElement).checked ? [...ids, id] : ids.filter(value => value !== id));
    }

    protected choose(day: Date): void {
        const [from, to] = this.range();
        this.range.set(to ? [day] : day >= from ? [from, day] : [day, from]);
    }

    protected async importWorklogs(): Promise<void> {
        const [start, end] = this.range();
        if (!end || this.busy() || !this.ids().length) return;
        this.error.set('');
        this.result.set(null);
        this.busy.set(true);
        this.dialog.disableClose = true;
        try {
            this.result.set(await this.api.importJiraWorklogs({
                startDate: formatISO(start), endDate: formatISO(endOfDay(end)), connectionIds: this.ids()
            }));
        } catch (error) { this.error.set(errorMessage(error)); }
        finally { this.busy.set(false); this.dialog.disableClose = false; }
    }
}
