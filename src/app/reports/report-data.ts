import { eachDayOfInterval, endOfMonth, format, isWeekend, startOfMonth } from 'date-fns';
import type { TimeSlice } from '@/lib/api';
import { sliceSeconds } from '../shared/duration.pipe';

export interface MonthRow {
    id: number;
    key?: string;
    description: string;
    connectionId: number | null;
    connection: string;
    days: Map<number, { slices: TimeSlice[]; seconds: number }>;
    total: number;
}

export function monthRows(slices: TimeSlice[], now: number): MonthRow[] {
    const rows = new Map<number, MonthRow>();
    for (const slice of slices) {
        const day = new Date(slice.start_time).getDate();
        const row = rows.get(slice.work_item_id) ?? {
            id: slice.work_item_id, key: slice.jira_key, description: slice.work_item_description || 'Unknown work item',
            connectionId: slice.jira_connection_id ?? null, connection: slice.connection_name || 'Manual / No Connection',
            days: new Map(), total: 0
        };
        const cell = row.days.get(day) ?? { slices: [], seconds: 0 };
        const duration = sliceSeconds(slice, now);
        cell.slices.push(slice);
        cell.seconds += duration;
        row.days.set(day, cell);
        row.total += duration;
        rows.set(row.id, row);
    }
    return [...rows.values()].sort((first, second) =>
        (first.key ?? '').localeCompare(second.key ?? '') || first.description.localeCompare(second.description));
}

export function yearOverview(year: number, slices: TimeSlice[], now: number) {
    const months = Array.from({ length: 12 }, (_, month) => {
        const date = new Date(year, month, 1);
        const workDays = eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) }).filter(day => !isWeekend(day)).length;
        return { label: format(date, 'MMM'), actual: 0, expected: workDays * 8 };
    });
    for (const slice of slices) {
        const start = new Date(slice.start_time);
        if (start.getFullYear() === year) months[start.getMonth()].actual += sliceSeconds(slice, now) / 3600;
    }
    return months.map(month => ({ ...month, actual: Math.round(month.actual * 10) / 10 }));
}

export function hourAxisTicks(maximum: number): number[] {
    if (maximum <= 0) return [0, 1, 2, 3, 4];
    const interval = maximum / 4;
    const digitCount = Math.floor(Math.log10(interval)) + 1;
    const increment = 10 ** digitCount * (digitCount === 1 ? .1 : .05);
    const step = Math.ceil(Number((interval / increment).toPrecision(12))) * increment;
    return Array.from({ length: 5 }, (_, index) => Number((index * step).toPrecision(12)));
}
