import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TimeSlice } from "@/lib/api"
import { Edit2, Trash2, SplitSquareHorizontal, MoveRight, Play, Copy, Merge } from "lucide-react"

interface TimeSliceContextMenuProps {
    children: React.ReactNode;
    slice: TimeSlice;
    onEdit: (slice: TimeSlice) => void;
    onSplit: (slice: TimeSlice) => void;
    onMove: (slice: TimeSlice) => void;
    onDelete: (slice: TimeSlice) => void;
    onResume: (slice: TimeSlice) => void;
    onCopy: (slice: TimeSlice) => void;
    onMerge?: () => void;
    canMerge?: boolean;
}

export function TimeSliceContextMenu({ children, slice, onEdit, onSplit, onMove, onDelete, onResume, onCopy, onMerge, canMerge }: TimeSliceContextMenuProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64">
                {canMerge && (
                    <>
                        <ContextMenuItem onClick={onMerge} className="text-amber-600 focus:text-amber-600">
                            <Merge className="mr-2 h-3.5 w-3.5" />
                            Merge Selected Slices
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                    </>
                )}
                <ContextMenuItem onClick={() => onEdit(slice)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Time / Notes
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onResume(slice)}>
                    <Play className="mr-2 h-4 w-4 text-primary" />
                    Resume Tracking
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onSplit(slice)}>
                    <SplitSquareHorizontal className="mr-2 h-4 w-4" />
                    Split Slice
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onMove(slice)}>
                    <MoveRight className="mr-2 h-4 w-4" />
                    Move to Work Item...
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onCopy(slice)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy to other days...
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onDelete(slice)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
