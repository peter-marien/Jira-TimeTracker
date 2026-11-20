import { Pipe, type PipeTransform } from '@angular/core';
import { formatDuration } from '@/lib/time-utils';

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
    transform(seconds: number | null | undefined): string {
        return formatDuration(Math.max(0, seconds ?? 0));
    }
}

export function sliceSeconds(slice: { start_time: string; end_time?: string | null }, now = Date.now()): number {
    return Math.max(0, Math.floor(((slice.end_time ? Date.parse(slice.end_time) : now) - Date.parse(slice.start_time)) / 1000));
}

export function elapsedClock(seconds: number): string {
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
        .map(part => String(part).padStart(2, '0')).join(':');
}
