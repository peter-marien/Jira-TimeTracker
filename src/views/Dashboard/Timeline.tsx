import { TimeSlice, JiraConnection, api } from "@/lib/api"
import { startOfDay, setHours, endOfDay, format } from "date-fns"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
    DndContext,
    useDraggable,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragMoveEvent
} from "@dnd-kit/core"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import { useState, useRef, useEffect, useMemo } from "react"
import { TimelineConflictDialog, ConflictResolutionBehavior } from "@/components/Dashboard/TimelineConflictDialog"

interface TimelineProps {
    date: Date;
    slices: TimeSlice[];
    className?: string;
    onSliceClick?: (slice: TimeSlice) => void;
    connections?: JiraConnection[];
    otherColor?: string;
    onSlicesUpdated?: () => void;
}

interface InteractiveState {
    id: number;
    type: 'drag' | 'resize-start' | 'resize-end';
    startOffsetMs: number;
    endOffsetMs: number;
}

export function Timeline({ date, slices, className, onSliceClick, connections, otherColor, onSlicesUpdated }: TimelineProps) {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const timelineRef = useRef<HTMLDivElement>(null);

    const [roundingInterval, setRoundingInterval] = useState(1);
    const [roundingEnabled, setRoundingEnabled] = useState(false);
    const [interactiveState, setInteractiveState] = useState<InteractiveState | null>(null);
    const [conflictData, setConflictData] = useState<{ targetId: number, movedSlice: TimeSlice, newStart: string, newEnd: string } | null>(null);

    useEffect(() => {
        api.getSettings().then(s => {
            setRoundingEnabled(s.rounding_enabled === 'true');
            setRoundingInterval(parseInt(s.rounding_interval || '15', 10));
        });
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    // 1. Calculate Bounds
    const { timelineStart, totalMs } = useMemo(() => {
        if (slices.length > 0) {
            const sliceTimes = slices.map(s => ({
                start: new Date(s.start_time).getTime(),
                end: s.end_time ? new Date(s.end_time).getTime() : Date.now()
            }));

            const firstStart = Math.min(...sliceTimes.map(s => s.start));
            const lastEnd = Math.max(...sliceTimes.map(s => s.end));

            let targetStart = firstStart - (0.5 * 60 * 60 * 1000);
            let targetEnd = lastEnd + (0.5 * 60 * 60 * 1000);

            const minSpan = 10 * 60 * 60 * 1000;
            const currentSpan = targetEnd - targetStart;

            if (currentSpan < minSpan) {
                const extra = minSpan - currentSpan;
                targetStart -= extra / 2;
                targetEnd += extra / 2;
            }

            const tStart = Math.max(dayStart.getTime(), targetStart);
            const tEnd = Math.min(dayEnd.getTime(), targetEnd);
            return { timelineStart: tStart, timelineEnd: tEnd, totalMs: tEnd - tStart };
        }
        return {
            timelineStart: setHours(dayStart, 7).getTime(),
            timelineEnd: setHours(dayStart, 19).getTime(),
            totalMs: 12 * 60 * 60 * 1000
        };
    }, [slices, dayStart, dayEnd]);

    const startHour = new Date(timelineStart).getHours();
    const hoursCount = Math.ceil(totalMs / (60 * 60 * 1000));

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const slice = slices.find(s => s.id === active.id);
        if (!slice || !slice.end_time) return;

        // Determine if we are resizing or dragging based on the target element
        const target = event.activatorEvent.target as HTMLElement;
        const type = target.getAttribute('data-type') as 'drag' | 'resize-start' | 'resize-end' || 'drag';

        setInteractiveState({
            id: Number(active.id),
            type,
            startOffsetMs: 0,
            endOffsetMs: 0
        });
    };

    const handleDragMove = (event: DragMoveEvent) => {
        if (!interactiveState || !timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const deltaMs = (event.delta.x / rect.width) * totalMs;

        let snappedDelta = deltaMs;
        if (roundingEnabled) {
            const intervalMs = roundingInterval * 60 * 1000;
            snappedDelta = Math.round(deltaMs / intervalMs) * intervalMs;
        }

        setInteractiveState(prev => prev ? {
            ...prev,
            startOffsetMs: prev.type === 'resize-end' ? 0 : snappedDelta,
            endOffsetMs: prev.type === 'resize-start' ? 0 : snappedDelta
        } : null);
    };

    const handleDragEnd = async () => {
        const state = interactiveState;
        setInteractiveState(null);

        if (!state) return;

        const slice = slices.find(s => s.id === state.id);
        if (!slice || !slice.end_time) return;

        const originalStart = new Date(slice.start_time).getTime();
        const originalEnd = new Date(slice.end_time).getTime();

        const newStartMs = originalStart + state.startOffsetMs;
        const newEndMs = originalEnd + state.endOffsetMs;

        // Validation: end must be after start
        if (newEndMs <= newStartMs) return;

        const newStart = new Date(newStartMs).toISOString();
        const newEnd = new Date(newEndMs).toISOString();

        // Check for conflicts
        const conflictingSlice = slices.find(other => {
            if (other.id === slice.id) return false;
            const otherStart = new Date(other.start_time).getTime();
            const otherEnd = other.end_time ? new Date(other.end_time).getTime() : Date.now();
            return (newStartMs < otherEnd && otherStart < newEndMs);
        });

        if (conflictingSlice) {
            setConflictData({ targetId: conflictingSlice.id, movedSlice: slice, newStart, newEnd });
        } else {
            await api.saveTimeSlice({
                ...slice,
                start_time: newStart,
                end_time: newEnd
            });
            onSlicesUpdated?.();
        }
    };

    const handleResolveConflict = async (behavior: ConflictResolutionBehavior) => {
        if (!conflictData) return;
        const { targetId, movedSlice, newStart, newEnd } = conflictData;

        try {
            const target = slices.find(s => s.id === targetId);
            if (!target) return;

            const movedStartMs = new Date(newStart).getTime();
            const movedEndMs = new Date(newEnd).getTime();
            const targetStartMs = new Date(target.start_time).getTime();
            const targetEndMs = target.end_time ? new Date(target.end_time).getTime() : Date.now();

            if (behavior === 'split_preserve_duration') {
                // Split target and push second half

                // 1. Existing slice before moved part
                if (targetStartMs < movedStartMs) {
                    await api.saveTimeSlice({ ...target, end_time: newStart });
                } else {
                    // Target starts after or at moved start, delete or truncate
                    // This is complex, but let's assume simple split for now
                }

                // 2. Existing slice after moved part (pushed)
                const remainingDurationMs = targetEndMs - Math.max(targetStartMs, movedStartMs);
                if (remainingDurationMs > 0) {
                    await api.saveTimeSlice({
                        work_item_id: target.work_item_id,
                        jira_connection_id: target.jira_connection_id,
                        notes: target.notes,
                        start_time: newEnd,
                        end_time: new Date(movedEndMs + remainingDurationMs).toISOString()
                    });
                }
            } else {
                // Split and preserve end time (overwrite middle)
                if (targetStartMs < movedStartMs) {
                    await api.saveTimeSlice({ ...target, end_time: newStart });
                }
                if (targetEndMs > movedEndMs) {
                    await api.saveTimeSlice({
                        work_item_id: target.work_item_id,
                        jira_connection_id: target.jira_connection_id,
                        notes: target.notes,
                        start_time: newEnd,
                        end_time: target.end_time
                    });
                }
            }

            // Finally save the moved slice
            await api.saveTimeSlice({
                ...movedSlice,
                start_time: newStart,
                end_time: newEnd
            });

            setConflictData(null);
            onSlicesUpdated?.();
        } catch (err) {
            console.error("Failed to resolve conflict:", err);
        }
    };

    return (
        <div
            ref={timelineRef}
            className={cn("relative h-20 w-full bg-secondary/10 rounded-xl border shadow-inner group/timeline", className)}
        >
            <DndContext
                sensors={sensors}
                modifiers={[restrictToHorizontalAxis]}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
            >
                {/* Hour markers */}
                <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: hoursCount }).map((_, i) => (
                        <div key={i} className="flex-1 border-r border-border/10 last:border-0 relative">
                            <span className="absolute bottom-1 left-1 text-[9px] text-muted-foreground/40 font-mono">
                                {(startHour + i).toString().padStart(2, '0')}:00
                            </span>
                        </div>
                    ))}
                </div>

                {/* Slices */}
                {slices.map(slice => (
                    <TimelineSlice
                        key={slice.id}
                        slice={slice}
                        timelineStart={timelineStart}
                        totalMs={totalMs}
                        interactive={interactiveState?.id === slice.id ? interactiveState : null}
                        connections={connections}
                        otherColor={otherColor}
                        onSliceClick={onSliceClick}
                        slices={slices}
                    />
                ))}
            </DndContext>

            <TimelineConflictDialog
                open={!!conflictData}
                onOpenChange={(open) => !open && setConflictData(null)}
                onResolve={handleResolveConflict}
            />
        </div>
    )
}

interface TimelineSliceProps {
    slice: TimeSlice;
    timelineStart: number;
    totalMs: number;
    interactive: InteractiveState | null;
    connections?: JiraConnection[];
    otherColor?: string;
    onSliceClick?: (slice: TimeSlice) => void;
    slices: TimeSlice[];
}

function TimelineSlice({ slice, timelineStart, totalMs, interactive, connections, otherColor, onSliceClick, slices }: TimelineSliceProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: slice.id,
        disabled: !slice.end_time || !!interactive && interactive.id !== slice.id
    });

    const startRaw = new Date(slice.start_time).getTime() + (interactive?.startOffsetMs || 0);
    const endRaw = (slice.end_time ? new Date(slice.end_time).getTime() : Date.now()) + (interactive?.endOffsetMs || 0);

    const hasOverlap = useMemo(() => {
        return slices.some(other => {
            if (other.id === slice.id) return false;
            const otherStart = new Date(other.start_time).getTime();
            const otherEnd = other.end_time ? new Date(other.end_time).getTime() : Date.now();
            return (startRaw < otherEnd && otherStart < endRaw);
        });
    }, [slice.id, startRaw, endRaw, slices]);

    const start = Math.max(startRaw, timelineStart);
    const end = Math.min(endRaw, timelineStart + totalMs);

    if (end <= start) return null;

    const leftPercent = ((start - timelineStart) / totalMs) * 100;
    const widthPercent = ((end - start) / totalMs) * 100;
    const isActive = !slice.end_time;

    const connId = slice.jira_connection_id;
    const connection = connId ? connections?.find(c => c.id === connId) : null;
    const sliceColor = connection?.color || (connId ? 'hsl(var(--primary))' : otherColor || '#64748b');

    const showDetails = widthPercent > 4;
    const showTimes = widthPercent > 15;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    ref={setNodeRef}
                    {...listeners}
                    {...attributes}
                    onDoubleClick={() => onSliceClick?.(slice)}
                    className={cn(
                        "absolute top-3 bottom-5 rounded-xl transition-all flex flex-col justify-center items-center px-1 overflow-hidden",
                        isActive
                            ? "shadow-[0_0_10px_rgba(0,0,0,0.2)] animate-pulse brightness-110 border-white/20 border cursor-default"
                            : "hover:brightness-110 shadow-sm border border-white/5 cursor-grab active:cursor-grabbing",
                        isDragging && "z-50 opacity-80 cursor-grabbing",
                        hasOverlap && "ring-2 ring-red-500 z-10"
                    )}
                    style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: sliceColor,
                    }}
                >
                    {/* Resize Handles */}
                    {!isActive && (
                        <>
                            <div
                                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-white/20"
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    // Custom handle for resize-start
                                    // In dnd-kit, handles are usually separate sensors or data attributes
                                }}
                                {...listeners}
                                data-type="resize-start"
                            />
                            <div
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-white/20"
                                {...listeners}
                                data-type="resize-end"
                            />
                        </>
                    )}

                    {showDetails && (
                        <span className="text-[10px] font-bold text-white truncate w-full text-center select-none">
                            {slice.jira_key || 'Manual'}
                        </span>
                    )}

                    {showTimes && (
                        <div className="flex justify-between w-full px-1 text-[8px] text-white/70 font-mono absolute bottom-0.5 select-none">
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
    );
}
