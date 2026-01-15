import { TimeSlice, JiraConnection } from "@/lib/api"
import { TimeDisplay } from "@/components/shared/TimeDisplay"
import { DurationDisplay } from "@/components/shared/DurationDisplay"
import { TimeSliceContextMenu } from "./TimeSliceContextMenu"
import { differenceInSeconds, format } from "date-fns"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Copy, Pencil, Play, Trash2, ArrowRightLeft, MoreHorizontal, Split, Merge, FileEdit } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface TimeSliceTableProps {
    slices: TimeSlice[];
    selectedIds?: Set<number>;
    onSelectionChange?: (ids: Set<number>) => void;
    onEdit: (slice: TimeSlice) => void;
    onSplit: (slice: TimeSlice) => void;
    onMove: (slice: TimeSlice) => void;
    onDelete: (slice: TimeSlice) => void;
    onResume: (slice: TimeSlice) => void;
    onCopy: (slice: TimeSlice) => void;
    onMerge?: () => void;
    onDoubleClick?: (slice: TimeSlice) => void;
    connections?: JiraConnection[];
    otherColor?: string;
    onEditWorkItem?: (slice: TimeSlice) => void;
    showDate?: boolean;
}

import { useState } from "react";

export function TimeSliceTable({
    slices,
    selectedIds = new Set(),
    onSelectionChange,
    onEdit,
    onSplit,
    onMove,
    onDelete,
    onResume,
    onCopy,
    onMerge,
    onDoubleClick,
    connections,
    otherColor,
    onEditWorkItem,
    showDate = false
}: TimeSliceTableProps) {
    const [lastClickedId, setLastClickedId] = useState<number | null>(null);

    if (slices.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">No time tracked for this day.</div>
    }

    const handleRowClick = (e: React.MouseEvent, slice: TimeSlice) => {
        if (!onSelectionChange) return;

        const sortedSlices = [...slices].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        if (e.shiftKey && lastClickedId !== null) {
            const currentIndex = sortedSlices.findIndex(s => s.id === slice.id);
            const lastIndex = sortedSlices.findIndex(s => s.id === lastClickedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const rangeIds = sortedSlices.slice(start, end + 1).map(s => s.id);

                const newSelection = e.ctrlKey || e.metaKey ? new Set(selectedIds) : new Set<number>();
                rangeIds.forEach(id => newSelection.add(id));
                onSelectionChange(newSelection);
            }
        } else if (e.ctrlKey || e.metaKey) {
            const newSelection = new Set(selectedIds);
            if (newSelection.has(slice.id)) {
                newSelection.delete(slice.id);
            } else {
                newSelection.add(slice.id);
            }
            onSelectionChange(newSelection);
        } else {
            onSelectionChange(new Set([slice.id]));
        }

        setLastClickedId(slice.id);
    };

    const gridCols = showDate
        ? "grid-cols-[6rem_6rem_6rem_8rem_1fr_6rem_3rem]"
        : "grid-cols-[6rem_6rem_8rem_1fr_6rem_3rem]";

    return (
        <div className="rounded-md border bg-card">
            <div className={`grid ${gridCols} gap-4 p-4 border-b font-medium text-sm text-muted-foreground bg-secondary/20`}>
                {showDate && <div>Date</div>}
                <div>Start</div>
                <div>End</div>
                <div>Jira Key</div>
                <div>Work Item</div>
                <div className="text-right">Duration</div>
                <div className="text-right">Actions</div>
            </div>
            <div className="divide-y divide-border">
                {[...slices].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).map(slice => {
                    const start = new Date(slice.start_time);
                    const end = slice.end_time ? new Date(slice.end_time) : null;
                    const duration = end ? differenceInSeconds(end, start) : 0;
                    const isActive = !slice.end_time;
                    const isSelected = selectedIds.has(slice.id);

                    // Check if synced and if times have changed
                    const isSynced = slice.synced_to_jira === 1;
                    const isOutOfSync = isSynced && (
                        slice.start_time !== slice.synced_start_time ||
                        slice.end_time !== slice.synced_end_time
                    );

                    const Content = (
                        <div
                            className={cn(
                                `grid ${gridCols} gap-4 p-4 items-center transition-colors cursor-default select-none`,
                                isSelected ? "bg-primary/15 hover:bg-primary/20" : "hover:bg-accent/50",
                                isActive && !isSelected && "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary"
                            )}
                            onClick={(e) => handleRowClick(e, slice)}
                            onDoubleClick={() => onDoubleClick ? onDoubleClick(slice) : onEdit(slice)}
                        >
                            {/* Date Column */}
                            {showDate && (
                                <div className="flex flex-col text-sm text-muted-foreground">
                                    {format(start, "dd-MM-yyyy")}
                                </div>
                            )}

                            {/* Start Column */}
                            <div className="flex flex-col text-sm">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="w-fit cursor-help">
                                            <TimeDisplay date={start} className="font-semibold text-foreground/90" />
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>{format(start, "PPP HH:mm:ss")}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                            {/* End Column */}
                            <div className="flex flex-col text-sm">
                                {end ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="w-fit cursor-help">
                                                <TimeDisplay date={end} className="text-foreground/70" />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            <p>{format(end, "PPP HH:mm:ss")}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <span className="text-primary font-medium animate-pulse text-xs">Now</span>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5">
                                {slice.jira_key ? (
                                    <>
                                        {(() => {
                                            const connId = slice.jira_connection_id;
                                            const connection = connId ? connections?.find(c => c.id === connId) : null;
                                            const badgeColor = connection?.color || (connId ? 'hsl(var(--primary))' : (otherColor || '#64748b'));
                                            const isHex = badgeColor.startsWith('#');

                                            return (
                                                <span
                                                    className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                                    style={{
                                                        backgroundColor: isHex ? `${badgeColor}20` : `hsl(var(--primary) / 0.1)`,
                                                        color: badgeColor
                                                    }}
                                                >
                                                    {slice.jira_key}
                                                </span>
                                            );
                                        })()}
                                        {isOutOfSync ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Out of sync with Jira</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : isSynced ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Synced to Jira</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : null}
                                    </>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground/40 italic px-2">Manual</span>
                                )}
                            </div>

                            {/* Work Item Column */}
                            <div className="flex flex-col gap-1 min-w-0 py-1">
                                <span className="font-medium truncate">{slice.work_item_description}</span>
                                {slice.notes ? (
                                    <p className="text-xs text-muted-foreground break-words max-w-[500px] whitespace-pre-wrap">
                                        {slice.notes}
                                    </p>
                                ) : (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Missing notes</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>

                            {/* Duration Column */}
                            <div className="text-right font-mono text-sm">
                                {isActive ? (
                                    <span className="text-primary font-medium">Tracking</span>
                                ) : (
                                    <DurationDisplay seconds={duration} />
                                )}
                            </div>

                            {/* Actions Column */}
                            <div className="flex justify-end">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {selectedIds.size > 1 && selectedIds.has(slice.id) && (
                                            <>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMerge?.(); }} className="text-amber-600 focus:text-amber-600">
                                                    <Merge className="mr-2 h-4 w-4" />
                                                    Merge Selected
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                            </>
                                        )}
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(slice); }}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit Time
                                        </DropdownMenuItem>
                                        {onEditWorkItem && (
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditWorkItem(slice); }}>
                                                <FileEdit className="mr-2 h-4 w-4" />
                                                Edit Work Item
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResume(slice); }}>
                                            <Play className="mr-2 h-4 w-4 text-primary" />
                                            Resume
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSplit(slice); }}>
                                            <Split className="mr-2 h-4 w-4" />
                                            Split
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(slice); }}>
                                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                                            Move
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(slice); }}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy to other days
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(slice); }} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    );

                    return (
                        <TimeSliceContextMenu
                            key={slice.id}
                            slice={slice}
                            onEdit={onEdit}
                            onSplit={onSplit}
                            onMove={onMove}
                            onDelete={onDelete}
                            onResume={onResume}
                            onCopy={onCopy}
                            onMerge={onMerge}
                            canMerge={selectedIds.size > 1 && selectedIds.has(slice.id)}
                            onEditWorkItem={onEditWorkItem}
                        >
                            {Content}
                        </TimeSliceContextMenu>
                    )
                })}
            </div>
        </div>
    )
}
