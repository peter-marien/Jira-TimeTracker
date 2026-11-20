import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { addMonths, eachDayOfInterval, endOfMonth, format, formatISO, isSameMonth, isWeekend, startOfDay, startOfMonth } from 'date-fns';
import { DESKTOP_API, DesktopSettings, ViewDates, errorMessage } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { HoursChart } from './hours-chart';
import { MonthCellDialog } from './month-cell-dialog';
import { MonthHoursMatrix, type MonthCell } from './month-hours-matrix';
import { hourAxisTicks, monthRows, type MonthRow } from './report-data';

@Component({
    imports: [DatePipe, LucideChevronLeft, LucideChevronRight, MatTabsModule, HoursChart, MonthHoursMatrix],
    templateUrl: './month-page.html',
    styles: [`
        :host { display:block; height:100%; }
        .month-page { height:100%; min-height:0; grid-template-rows:auto minmax(0,1fr); gap:16px; }
        .tab-content { display:block; margin-top:8px; }
        app-month-hours-matrix.tab-content { height:calc(100% - 8px); }
        .month-summary { display:flex; gap:24px; }
        .month-summary > div { display:flex; flex-direction:column; }
        .month-summary > div + div { padding-left:24px; border-left:1px solid hsl(var(--border)); }
        .month-summary span { color:hsl(var(--muted-foreground)); font-size:10px; text-transform:uppercase; letter-spacing:.05em; font-weight:700; }
        .month-summary strong { font-size:18px; line-height:28px; font-weight:600; white-space:nowrap; }
        .project-chart { display:grid; height:100%; align-items:stretch; padding:5px 30px 5px 40px; }
        .project-row { display:grid; grid-template-columns:80px minmax(0,1fr); align-items:center; }
        .project-label { display:flex; align-items:center; justify-content:flex-end; gap:2px; }
        .project-label::after { content:''; width:6px; border-top:1px solid #666; }
        .project-bar { height:100%; display:flex; align-items:center; position:relative; gap:5px; }
        .project-value { position:relative; display:block; height:80%; border-radius:0 4px 4px 0; }
        .project-axis { position:absolute; inset:0; display:flex; justify-content:space-between; pointer-events:none; }
        .project-axis span { border-left:1px dashed hsl(var(--border) / .5); }
        .project-axis span:first-child { border-left:1px solid #666; }
        .project-tooltip { position:absolute; z-index:2; pointer-events:none; bottom:50%; left:50%; width:max-content; max-width:min(400px, 100%); }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthPage {
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject(MatDialog);
    private readonly router = inject(Router);
    private readonly tracking = inject(TrackingService);
    private readonly settings = inject(DesktopSettings);
    protected readonly month = inject(ViewDates).month;
    protected readonly today = new Date();
    protected readonly tab = signal(0);
    protected readonly message = errorMessage;
    private readonly hoursFormat = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2, useGrouping: false });
    protected formatHours(hours: number): string { return this.hoursFormat.format(hours); }
    protected readonly days = computed(() => eachDayOfInterval({ start: startOfMonth(this.month()), end: endOfMonth(this.month()) }));
    protected readonly dayLabels = computed(() => this.days().map(day => format(day, 'EEE d')));
    protected readonly chartDates = computed(() => this.days().map(day => format(day, 'MMM d')));
    protected readonly data = resource({
        params: () => ({ month: this.month(), revision: this.tracking.revision() }),
        loader: async ({ params }) => {
            const [slices, connections] = await Promise.all([
                this.api.getTimeSlices(formatISO(startOfMonth(params.month)), formatISO(endOfMonth(params.month))),
                this.api.getJiraConnections()
            ]);
            return { slices, connections };
        }
    });
    protected readonly rows = computed(() => monthRows(this.data.hasValue() ? this.data.value().slices : [], Date.now()));
    protected readonly groups = computed(() => {
        const groups = new Map<number | null, { id: number | null; label: string; rows: MonthRow[] }>();
        for (const row of this.rows()) {
            const group = groups.get(row.connectionId) ?? { id: row.connectionId, label: row.connection, rows: [] };
            group.rows.push(row);
            groups.set(group.id, group);
        }
        return [...groups.values()];
    });
    protected readonly stats = computed(() => {
        const weekdays = this.days().filter(day => !isWeekend(day));
        const goal = Number(this.settings.values()['daily_target_hours']) || 8;
        const total = this.rows().reduce((sum, row) => sum + row.total, 0) / 3600;
        const lastDay = Math.max(0, ...this.rows().flatMap(row => [...row.days.keys()]));
        const workedWeekdays = weekdays.filter(day => day.getDate() <= lastDay).length;
        const stats = [
            { label: 'Total working days', value: weekdays.length, unit: '' },
            { label: 'Target hours', value: weekdays.length * goal, unit: 'h' },
            { label: 'Actual hours', value: total, unit: 'h' },
            { label: 'Average hours/workday', value: workedWeekdays ? total / workedWeekdays : 0, unit: 'h' },
            { label: 'Overtime Month', value: total - weekdays.length * goal, unit: 'h', overtime: true }
        ];
        if (isSameMonth(this.month(), this.today)) {
            const todayDate = this.today.getDate();
            const todayHours = this.rows().reduce((sum, row) => sum + (row.days.get(todayDate)?.seconds ?? 0), 0) / 3600;
            stats.splice(4, 0,
                { label: 'Overtime until yesterday', value: total - todayHours - weekdays.filter(day => day < startOfDay(this.today)).length * goal, unit: 'h', overtime: true },
                { label: 'Overtime until today', value: total - weekdays.filter(day => day.getDate() <= todayDate).length * goal, unit: 'h', overtime: true });
        }
        return stats;
    });
    protected readonly dailyCharts = computed(() => {
        const values = (rows: MonthRow[]) => this.days().map(day =>
            Number((rows.reduce((sum, row) => sum + (row.days.get(day.getDate())?.seconds ?? 0), 0) / 3600).toFixed(2)));
        const connections = this.data.hasValue() ? this.data.value().connections : [];
        const groups = this.groups();
        return [
            { label: 'Total Hours', color: 'hsl(var(--primary))', values: values(this.rows()) },
            ...connections.map(connection => ({
                label: connection.name, color: connection.color || '#8884d8',
                values: values(groups.find(group => group.id === connection.id)?.rows ?? [])
            })),
            { label: 'Manual / No Connection', color: '#64748b', values: values(groups.find(group => group.id === null)?.rows ?? []) }
        ].filter(chart => chart.values.some(value => value > 0));
    });
    protected readonly projects = computed(() => this.groups().flatMap(group => {
        const byName = new Map<string, { name: string; hours: number; rows: MonthRow[] }>();
        for (const row of group.rows) {
            const name = group.id === null ? 'Manual' : row.key?.match(/^([A-Z]+)-/)?.[1] ?? '(Unknown)';
            const project = byName.get(name) ?? { name, hours: 0, rows: [] };
            project.hours += row.total / 3600;
            project.rows.push(row);
            byName.set(name, project);
        }
        const connections = this.data.hasValue() ? this.data.value().connections : [];
        const color = connections.find(connection => connection.id === group.id)?.color || this.settings.values()['other_color'] || '#64748b';
        return [...byName.values()].map(project => ({
            group: group.id, name: project.name, hours: Number(project.hours.toFixed(2)), color,
            connection: group.id === null ? 'Manual / No Connection' : group.label,
            items: [...project.rows].sort((first, second) => second.total - first.total)
        }));
    }).filter(project => project.hours > 0).sort((first, second) => second.hours - first.hours));
    protected readonly projectMax = computed(() => hourAxisTicks(Math.max(0, ...this.projects().map(project => project.hours)))[4]);
    protected readonly hoveredProject = signal<string | null>(null);

    protected step(months: number): void { this.month.update(month => addMonths(month, months)); }

    protected open(cell: MonthCell): void { this.dialog.open(MonthCellDialog, { data: cell, width: '500px' }); }

    protected openDay(day: Date): void {
        void this.router.navigate(['/'], { queryParams: { date: format(day, 'yyyy-MM-dd') } });
    }
}
