import { TimeSlice } from "@/lib/api"
import { TimeDisplay } from "@/components/shared/TimeDisplay"
import { DurationDisplay } from "@/components/shared/DurationDisplay"
import { TimeSliceContextMenu } from "./TimeSliceContextMenu"
import { differenceInSeconds } from "date-fns"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Copy, Pencil, Play, Trash2, ArrowRightLeft, MoreHorizontal, Split } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface TimeSliceTableProps {
    slices: TimeSlice[];
    onEdit: (slice: TimeSlice) => void;
    onSplit: (slice: TimeSlice) => void;
    onMove: (slice: TimeSlice) => void;
    onDelete: (slice: TimeSlice) => void;
    onResume: (slice: TimeSlice) => void;
    onCopy: (slice: TimeSlice) => void;
    onDoubleClick?: (slice: TimeSlice) => void;
}

export function TimeSliceTable({ slices, onEdit, onSplit, onMove, onDelete, onResume, onCopy, onDoubleClick }: TimeSliceTableProps) {
    if (slices.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">No time tracked for this day.</div>
    }

    return (
        <div className="rounded-md border bg-card">
            <div className="grid grid-cols-[6rem_6rem_8rem_1fr_6rem_3rem] gap-4 p-4 border-b font-medium text-sm text-muted-foreground bg-secondary/20">
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

                    // Check if synced and if times have changed
                    const isSynced = slice.synced_to_jira === 1;
                    const isOutOfSync = isSynced && (
                        slice.start_time !== slice.synced_start_time ||
                        slice.end_time !== slice.synced_end_time
                    );

                    const Content = (
                        <div
                            className={cn("grid grid-cols-[6rem_6rem_8rem_1fr_6rem_3rem] gap-4 p-4 items-center hover:bg-accent/50 transition-colors cursor-default select-none", isActive && "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary")}
                            onDoubleClick={() => onDoubleClick ? onDoubleClick(slice) : onEdit(slice)}
                        >
                            {/* Start Column */}
                            <div className="flex flex-col text-sm">
                                <TimeDisplay date={start} className="font-semibold text-foreground/90" />
                            </div>

                            {/* End Column */}
                            <div className="flex flex-col text-sm">
                                {end ? (
                                    <TimeDisplay date={end} className="text-foreground/70" />
                                ) : (
                                    <span className="text-primary font-medium animate-pulse text-xs">Now</span>
                                )}
                            </div>

                            {/* Jira Key Column */}
                            <div className="flex items-center gap-1.5">
                                {slice.jira_key ? (
                                    <>
                                        <span className="text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                                            {slice.jira_key}
                                        </span>
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
                                {slice.notes && (
                                    <p className="text-xs text-muted-foreground break-words max-w-[500px] whitespace-pre-wrap">
                                        {slice.notes}
                                    </p>
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
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(slice)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onResume(slice)}>
                                            <Play className="mr-2 h-4 w-4 text-primary" />
                                            Resume
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onSplit(slice)}>
                                            <Split className="mr-2 h-4 w-4" />
                                            Split
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onMove(slice)}>
                                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                                            Move
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onCopy(slice)}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy to other days
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onDelete(slice)} className="text-destructive focus:text-destructive">
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
                        >
                            {Content}
                        </TimeSliceContextMenu>
                    )
                })}
            </div>
        </div>
    )
}
