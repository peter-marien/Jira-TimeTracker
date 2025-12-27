import { TimeSlice } from "@/lib/api"
import { startOfDay, endOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

interface TimelineProps {
    date: Date;
    slices: TimeSlice[];
    className?: string;
}

export function Timeline({ date, slices, className }: TimelineProps) {
    const dayStart = startOfDay(date).getTime();
    const dayEnd = endOfDay(date).getTime();
    const totalSeconds = (dayEnd - dayStart) / 1000;

    return (
        <div className={cn("relative h-16 w-full bg-secondary/20 rounded-md overflow-hidden border", className)}>
            {/* Hour markers can go here */}
            <div className="absolute inset-0 flex">
                {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="flex-1 border-r border-border/20 last:border-0 relative group">
                        <span className="absolute bottom-1 left-1 text-[10px] text-muted-foreground opacity-50 font-mono">{i}</span>
                    </div>
                ))}
            </div>

            <TooltipProvider>
                {slices.map(slice => {
                    const start = new Date(slice.start_time).getTime();
                    const end = slice.end_time ? new Date(slice.end_time).getTime() : Date.now(); // active slice goes to now

                    // Clamp to day
                    const clampedStart = Math.max(start, dayStart);
                    const clampedEnd = Math.min(end, dayEnd);

                    if (clampedEnd <= clampedStart) return null;

                    const leftPercent = ((clampedStart - dayStart) / 1000 / totalSeconds) * 100;
                    const widthPercent = ((clampedEnd - clampedStart) / 1000 / totalSeconds) * 100;

                    const isActive = !slice.end_time;

                    return (
                        <Tooltip key={slice.id}>
                            <TooltipTrigger asChild>
                                <div
                                    className={cn("absolute top-2 bottom-2 rounded-sm cursor-pointer transition-all hover:brightness-110 hover:shadow-sm",
                                        isActive ? "bg-emerald-500 animate-pulse" : "bg-primary/80"
                                    )}
                                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs p-2">
                                <p className="font-semibold">{slice.work_item_description}</p>
                                <p>{new Date(start).toLocaleTimeString()} - {slice.end_time ? new Date(end).toLocaleTimeString() : 'Now'}</p>
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </TooltipProvider>
        </div>
    )
}
