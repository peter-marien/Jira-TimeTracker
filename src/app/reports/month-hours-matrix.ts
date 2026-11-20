import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isWeekend } from 'date-fns';
import type { TimeSlice } from '@/lib/api';
import type { MonthRow } from './report-data';

export interface MonthCell { row: MonthRow; date: Date; slices: TimeSlice[] }

@Component({
    selector: 'app-month-hours-matrix',
    imports: [DatePipe, DecimalPipe],
    templateUrl: './month-hours-matrix.html',
    styleUrl: './month-hours-matrix.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthHoursMatrix {
    readonly label = input('Monthly hours');
    readonly days = input.required<Date[]>();
    readonly rows = input.required<MonthRow[]>();
    readonly opened = output<MonthCell>();
    readonly dayOpened = output<Date>();
    protected readonly totals = computed(() => this.days().map(day =>
        this.rows().reduce((total, row) => total + (row.days.get(day.getDate())?.seconds ?? 0), 0)));
    protected readonly sum = computed(() => this.rows().reduce((total, row) => total + row.total, 0));
    protected readonly weekend = isWeekend;
}
