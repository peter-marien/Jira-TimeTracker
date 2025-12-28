import { cn } from "@/lib/utils"

interface TimeDisplayProps {
    date?: string | Date; // ISO string or Date object
    timeStr?: string; // "HH:MM" string directly
    className?: string;
}

export function TimeDisplay({ date, timeStr, className }: TimeDisplayProps) {
    let display = "--:--:--";

    if (timeStr) {
        display = timeStr;
    } else if (date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (!isNaN(d.getTime())) {
            display = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        }
    }

    return (
        <span className={cn("font-mono-data tracking-tight text-sm", className)}>
            {display}
        </span>
    )
}
