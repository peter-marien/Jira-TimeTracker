import { cn } from "@/lib/utils"

interface DurationDisplayProps {
    seconds: number;
    className?: string;
    showSeconds?: boolean;
}

export function DurationDisplay({ seconds, className, showSeconds = true }: DurationDisplayProps) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const display = showSeconds
        ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${h}h ${m}m`;

    return (
        <span className={cn("font-mono-data text-tabular-nums", className)}>
            {display}
        </span>
    )
}
