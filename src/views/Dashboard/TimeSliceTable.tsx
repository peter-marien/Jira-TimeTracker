import { TimeSlice } from "@/lib/api"
import { TimeDisplay } from "@/components/shared/TimeDisplay"
import { DurationDisplay } from "@/components/shared/DurationDisplay"
import { JiraBadge } from "@/components/shared/JiraBadge"
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
import { MoreHorizontal, Pencil, Split, ArrowRightLeft, Trash2, CheckCircle2 } from "lucide-react"

interface TimeSliceTableProps {
    slices: TimeSlice[];
    onEdit: (slice: TimeSlice) => void;
    onSplit: (slice: TimeSlice) => void;
    onMove: (slice: TimeSlice) => void;
    onDelete: (slice: TimeSlice) => void;
}

export function TimeSliceTable({ slices, onEdit, onSplit, onMove, onDelete }: TimeSliceTableProps) {
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
                {slices.map(slice => {
                    const start = new Date(slice.start_time);
                    const end = slice.end_time ? new Date(slice.end_time) : null;
                    const duration = end ? differenceInSeconds(end, start) : 0;
                    const isActive = !slice.end_time;

                    const Content = (
                        <div
                            className={cn("grid grid-cols-[6rem_6rem_8rem_1fr_6rem_3rem] gap-4 p-4 items-center hover:bg-accent/50 transition-colors cursor-default select-none", isActive && "bg-emerald-500/5 hover:bg-emerald-500/10 border-l-2 border-l-emerald-500")}
                            onDoubleClick={() => onEdit(slice)}
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
                                    <span className="text-emerald-500 font-medium animate-pulse text-xs">Now</span>
                                )}
                            </div>

                            {/* Jira Key Column */}
                            <div className="flex items-center gap-1.5">
                                {slice.jira_key ? (
                                    <>
                                        <JiraBadge jiraKey={slice.jira_key} className="scale-90" />
                                        {slice.synced_to_jira === 1 && (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        )}
                                    </>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground/40 italic px-2">Manual</span>
                                )}
                            </div>

                            {/* Work Item Column */}
                            <div className="flex flex-col gap-1 min-w-0 py-1">
                                <span className="font-medium truncate">{slice.work_item_description}</span>
                                {slice.notes && (
                                    <p className="text-xs text-muted-foreground break-words max-w-[500px]">
                                        {slice.notes}
                                    </p>
                                )}
                            </div>

                            {/* Duration Column */}
                            <div className="text-right font-mono text-sm">
                                {isActive ? (
                                    <span className="text-emerald-500 font-medium">Tracking</span>
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
                                        <DropdownMenuItem onClick={() => onSplit(slice)}>
                                            <Split className="mr-2 h-4 w-4" />
                                            Split
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onMove(slice)}>
                                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                                            Move
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
                        >
                            {Content}
                        </TimeSliceContextMenu>
                    )
                })}
            </div>
        </div>
    )
}
