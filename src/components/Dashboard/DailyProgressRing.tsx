import { cn } from "@/lib/utils"

interface DailyProgressRingProps {
    totalMinutes: number;
    targetMinutes?: number; // default 480 (8h)
    size?: number;
    strokeWidth?: number;
    className?: string;
}

export function DailyProgressRing({
    totalMinutes,
    targetMinutes = 480,
    size = 48,
    strokeWidth = 4,
    className
}: DailyProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = Math.min(totalMinutes / targetMinutes, 1);
    const dashOffset = circumference - (progress * circumference);

    // Color logic: Red if very low, Yellow if approaching, Green if met
    // But per user request/image, it looks like a simple primary/muted split.
    // Let's stick to system colors: Primary for progress, Muted for background.

    return (
        <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
            {/* Background Circle */}
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="rotate-[-90deg]"
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-muted/20"
                />
                {/* Foreground Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-1000 ease-in-out"
                />
            </svg>

            {/* Center Text */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[20px] font-bold text-foreground">
                    {(totalMinutes / 60).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace('.', ',')}h
                </span>
            </div>
        </div>
    )
}
