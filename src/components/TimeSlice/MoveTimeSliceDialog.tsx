import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TimeSlice, api, WorkItem } from "@/lib/api"
import { useState } from "react"
import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"

interface MoveTimeSliceDialogProps {
    slice: TimeSlice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function MoveTimeSliceDialog({ slice, open, onOpenChange, onSave }: MoveTimeSliceDialogProps) {
    const [newItem, setNewItem] = useState<WorkItem | null>(null);

    const handleMove = async () => {
        if (!slice || !newItem) return;

        await api.saveTimeSlice({
            id: slice.id,
            work_item_id: newItem.id,
            start_time: slice.start_time,
            end_time: slice.end_time,
            notes: slice.notes
        });

        onSave();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Move Time Slice</DialogTitle>
                    <DialogDescription>
                        Reassign this time slice to a different work item.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>New Work Item</Label>
                        <WorkItemSearchBar onSelect={setNewItem} placeholder="Select work item..." autoFocus />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleMove} disabled={!newItem}>Move</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
