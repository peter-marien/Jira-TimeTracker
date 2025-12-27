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
import { MoreHorizontal, Pencil, Split, ArrowRightLeft, Trash2 } from "lucide-react"

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
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 p-4 border-b font-medium text-sm text-muted-foreground bg-secondary/20">
                <div className="w-32">Time</div>
                <div>Work Item</div>
                <div className="w-24 text-right">Duration</div>
                <div className="w-24 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border">
                {slices.map(slice => {
                    const start = new Date(slice.start_time);
                    const end = slice.end_time ? new Date(slice.end_time) : null;
                    const duration = end ? differenceInSeconds(end, start) : 0; // Or live duration if active? But active usually not in this list or listed as 'Tracking'
                    // Actually active slice IS in the list if fetched.
                    const isActive = !slice.end_time;

                    const Content = (
                        <div
                            className={cn("grid grid-cols-[auto_1fr_auto_auto] gap-4 p-4 items-center hover:bg-accent/50 transition-colors cursor-default select-none", isActive && "bg-emerald-500/5 hover:bg-emerald-500/10 border-l-2 border-l-emerald-500")}
                            onDoubleClick={() => onEdit(slice)}
                        >
                            {/* Time Column */}
                            <div className="w-32 flex flex-col text-sm">
                                <TimeDisplay date={start} className="font-semibold text-foreground/90" />
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    to
                                    {end ? <TimeDisplay date={end} /> : <span className="text-emerald-500 font-medium animate-pulse">Now</span>}
                                </span>
                            </div>

                            {/* Work Item Column */}
                            {/* Work Item Column */}
                            <div className="flex flex-col gap-1 min-w-0 py-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">{slice.work_item_description}</span>
                                    {slice.jira_key && <JiraBadge jiraKey={slice.jira_key} className="scale-90" />}
                                </div>
                                {slice.notes && (
                                    <p className="text-xs text-muted-foreground break-words max-w-[500px]">
                                        {slice.notes}
                                    </p>
                                )}
                            </div>

                            {/* Duration Column */}
                            <div className="w-24 text-right font-mono text-sm">
                                {isActive ? (
                                    <span className="text-emerald-500">Tracking</span>
                                ) : (
                                    <DurationDisplay seconds={duration} />
                                )}
                            </div>

                            {/* Actions Column */}
                            <div className="w-24 flex justify-end">
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
