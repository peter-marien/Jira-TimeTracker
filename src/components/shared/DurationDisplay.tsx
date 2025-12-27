import { cn } from "@/lib/utils"

interface DurationDisplayProps {
    seconds: number;
    className?: string;
}

export function DurationDisplay({ seconds, className }: DurationDisplayProps) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const display = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return (
        <span className={cn("font-mono-data text-tabular-nums", className)}>
            {display}
        </span>
    )
}
