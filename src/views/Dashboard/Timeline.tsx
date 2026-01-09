import { TimeSlice, JiraConnection } from "@/lib/api"
import { startOfDay, setHours, endOfDay, format } from "date-fns"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface TimelineProps {
    date: Date;
    slices: TimeSlice[];
    className?: string;
    onSliceClick?: (slice: TimeSlice) => void;
    connections?: JiraConnection[];
    otherColor?: string;
}

export function Timeline({ date, slices, className, onSliceClick, connections, otherColor }: TimelineProps) {
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

    // Helper to check for overlaps
    const getOverlapStatus = (currentSlice: TimeSlice) => {
        const currentStart = new Date(currentSlice.start_time).getTime();
        const currentEnd = currentSlice.end_time ? new Date(currentSlice.end_time).getTime() : Date.now();

        return slices.some(other => {
            if (other.id === currentSlice.id) return false;
            const otherStart = new Date(other.start_time).getTime();
            const otherEnd = other.end_time ? new Date(other.end_time).getTime() : Date.now();
            // Check if dates overlap
            return (currentStart < otherEnd && otherStart < currentEnd);
        });
    };

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
                const hasOverlap = getOverlapStatus(slice);

                const connId = slice.jira_connection_id;
                const connection = connId ? connections?.find(c => c.id === connId) : null;
                const sliceColor = connection?.color || (connId ? 'hsl(var(--primary))' : otherColor || '#64748b');

                // Text display logic: only show if block is wide enough
                const showDetails = widthPercent > 4;
                const showTimes = widthPercent > 15;

                return (
                    <Tooltip key={slice.id}>
                        <TooltipTrigger asChild>
                            <div
                                onDoubleClick={() => onSliceClick?.(slice)}
                                className={cn(
                                    "absolute top-3 bottom-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-center items-center px-1 overflow-hidden",
                                    isActive
                                        ? "shadow-[0_0_10px_rgba(0,0,0,0.2)] animate-pulse brightness-110 border-white/20 border"
                                        : "hover:brightness-110 shadow-sm border border-white/5",
                                    hasOverlap && "ring-2 ring-red-500 z-10"
                                )}
                                style={{
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    backgroundColor: sliceColor
                                }}
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
                                {hasOverlap && <p className="text-red-500 font-bold border-t pt-1 mt-1">⚠️ Overlapping Time Segment</p>}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                )
            })}
        </div>
    )
}
