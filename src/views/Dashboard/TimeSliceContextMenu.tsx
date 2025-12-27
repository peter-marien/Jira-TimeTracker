import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TimeSlice } from "@/lib/api"
import { Edit2, Trash2, SplitSquareHorizontal, MoveRight } from "lucide-react"

interface TimeSliceContextMenuProps {
    children: React.ReactNode;
    slice: TimeSlice;
    onEdit: (slice: TimeSlice) => void;
    onSplit: (slice: TimeSlice) => void;
    onMove: (slice: TimeSlice) => void;
    onDelete: (slice: TimeSlice) => void;
}

export function TimeSliceContextMenu({ children, slice, onEdit, onSplit, onMove, onDelete }: TimeSliceContextMenuProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64">
                <ContextMenuItem onClick={() => onEdit(slice)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Time / Notes
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
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onDelete(slice)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
