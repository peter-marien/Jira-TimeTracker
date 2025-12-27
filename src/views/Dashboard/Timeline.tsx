import { TimeSlice } from "@/lib/api"
import { startOfDay, setHours, endOfDay, format } from "date-fns"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

interface TimelineProps {
    date: Date;
    slices: TimeSlice[];
    className?: string;
}

export function Timeline({ date, slices, className }: TimelineProps) {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // 1. Calculate Bounds
    let viewStartTime: number;
    let viewEndTime: number;

    if (slices.length > 0) {
        const sliceTimes = slices.map(s => ({
            start: new Date(s.start_time).getTime(),
            end: s.end_time ? new Date(s.end_time).getTime() : Date.now()
        }));

        const firstStart = Math.min(...sliceTimes.map(s => s.start));
        const lastEnd = Math.max(...sliceTimes.map(s => s.end));

        // Start 0.5h before, end 0.5h after
        let targetStart = firstStart - (0.5 * 60 * 60 * 1000);
        let targetEnd = lastEnd + (0.5 * 60 * 60 * 1000);

        // Ensure at least 10h span
        const minSpan = 10 * 60 * 60 * 1000;
        const currentSpan = targetEnd - targetStart;

        if (currentSpan < minSpan) {
            const extra = minSpan - currentSpan;
            targetStart -= extra / 2;
            targetEnd += extra / 2;
        }

        // Clamp to day bounds
        viewStartTime = Math.max(dayStart.getTime(), targetStart);
        viewEndTime = Math.min(dayEnd.getTime(), targetEnd);

        // Re-adjust if clamping broke the 12h span (e.g. at start of day)
        if (viewEndTime - viewStartTime < minSpan) {
            if (viewStartTime === dayStart.getTime()) {
                viewEndTime = Math.min(dayEnd.getTime(), viewStartTime + minSpan);
            } else if (viewEndTime === dayEnd.getTime()) {
                viewStartTime = Math.max(dayStart.getTime(), viewEndTime - minSpan);
            }
        }
    } else {
        // Fallback: 7 AM - 7 PM (12h)
        viewStartTime = setHours(dayStart, 7).getTime();
        viewEndTime = setHours(dayStart, 19).getTime();
    }

    const timelineStart = viewStartTime;
    const timelineEnd = viewEndTime;
    const totalMs = timelineEnd - timelineStart;

    // We need to calculate how many hours to show in markers
    const startHour = new Date(timelineStart).getHours();
    const hoursCount = Math.ceil((timelineEnd - timelineStart) / (60 * 60 * 1000));

    return (
        <div className={cn("relative h-20 w-full bg-secondary/10 rounded-xl overflow-hidden border shadow-inner group/timeline", className)}>
            {/* Hour markers */}
            <div className="absolute inset-0 flex">
                {Array.from({ length: hoursCount }).map((_, i) => (
                    <div key={i} className="flex-1 border-r border-border/10 last:border-0 relative">
                        <span className="absolute bottom-1 left-1 text-[9px] text-muted-foreground/40 font-mono">
                            {(startHour + i).toString().padStart(2, '0')}:00
                        </span>
                    </div>
                ))}
            </div>

            {/* Slices */}
            <TooltipProvider>
                {slices.map(slice => {
                    const startRaw = new Date(slice.start_time).getTime();
                    const endRaw = slice.end_time ? new Date(slice.end_time).getTime() : Date.now();

                    // Clamp to visible timeline
                    const start = Math.max(startRaw, timelineStart);
                    const end = Math.min(endRaw, timelineEnd);

                    if (end <= start) return null;

                    const leftPercent = ((start - timelineStart) / totalMs) * 100;
                    const widthPercent = ((end - start) / totalMs) * 100;
                    const isActive = !slice.end_time;

                    // Text display logic: only show if block is wide enough
                    const showDetails = widthPercent > 8;
                    const showTimes = widthPercent > 15;

                    return (
                        <Tooltip key={slice.id}>
                            <TooltipTrigger asChild>
                                <div
                                    className={cn(
                                        "absolute top-3 bottom-5 rounded-md cursor-pointer transition-all border border-white/10 flex flex-col justify-center items-center px-1 overflow-hidden",
                                        isActive
                                            ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse border-emerald-400/30"
                                            : "bg-primary/90 hover:bg-primary shadow-sm"
                                    )}
                                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                >
                                    {showDetails && (
                                        <span className="text-[10px] font-bold text-white truncate w-full text-center">
                                            {slice.jira_key || 'Manual'}
                                        </span>
                                    )}

                                    {showTimes && (
                                        <div className="flex justify-between w-full px-1 text-[8px] text-white/70 font-mono absolute bottom-0.5">
                                            <span>{format(new Date(startRaw), "HH:mm")}</span>
                                            <span>{slice.end_time ? format(new Date(endRaw), "HH:mm") : "Now"}</span>
                                        </div>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs p-3">
                                <div className="space-y-1">
                                    <p className="font-bold flex items-center gap-2">
                                        {slice.jira_key && <span className="text-primary font-mono bg-primary/10 px-1 rounded">{slice.jira_key}</span>}
                                        {slice.work_item_description}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {format(new Date(startRaw), "HH:mm")} - {slice.end_time ? format(new Date(endRaw), "HH:mm") : 'Active Now'}
                                    </p>
                                    {slice.notes && <p className="italic border-t pt-1 mt-1">{slice.notes}</p>}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </TooltipProvider>
        </div>
    )
}
