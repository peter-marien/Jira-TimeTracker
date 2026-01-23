/**
 * Rounds a date to the nearest interval.
 * If intervalMinutes is 0 or 1, just clears the seconds.
 */
export function roundToNearestInterval(date: Date, intervalMinutes: number): Date {
    const result = new Date(date);
    result.setSeconds(0, 0); // Always clear seconds and milliseconds

    if (intervalMinutes <= 1) {
        return result;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    const timestamp = result.getTime();
    const roundedMs = Math.round(timestamp / intervalMs) * intervalMs;
    return new Date(roundedMs);
}

/**
 * Formats a duration in seconds into a human-readable string (e.g., "1h 30m" or "45m").
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
