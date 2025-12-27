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
import { Input } from "@/components/ui/input"
import { TimeSlice, api, WorkItem } from "@/lib/api"
import { useState, useEffect } from "react"
import { format, differenceInMinutes, addMinutes } from "date-fns"
import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"

interface SplitTimeSliceDialogProps {
    slice: TimeSlice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function SplitTimeSliceDialog({ slice, open, onOpenChange, onSave }: SplitTimeSliceDialogProps) {
    const [splitTime, setSplitTime] = useState("");
    const [newItem, setNewItem] = useState<WorkItem | null>(null);

    // Logic: Split slice at 'splitTime'. 
    // Original slice becomes: start -> splitTime
    // New slice becomes: splitTime -> end
    // New slice assigned to 'newItem' (or same item if not selected).

    useEffect(() => {
        if (slice && open) {
            // Default split at midpoint? Or just start time?
            // Let's default to midpoint or start + 5m
            const start = new Date(slice.start_time);
            const end = slice.end_time ? new Date(slice.end_time) : new Date();
            const mid = addMinutes(start, differenceInMinutes(end, start) / 2);
            setSplitTime(format(mid, "HH:mm"));
        }
    }, [slice, open]);

    const handleSplit = async () => {
        if (!slice || !newItem) return; // Must select work item for second part? Or optional (keep same)
        // Requirement: "The user can select the work-item of each newly created time-slice"

        const dateBase = slice.start_time.split('T')[0];
        const splitISO = `${dateBase}T${splitTime}:00`;

        // 1. Update original slice end time
        await api.saveTimeSlice({
            id: slice.id,
            work_item_id: slice.work_item_id,
            start_time: slice.start_time,
            end_time: splitISO,
            notes: slice.notes // Keep notes?
        });

        // 2. Create new slice
        await api.saveTimeSlice({
            work_item_id: newItem.id, // Or slice.work_item_id if null?
            start_time: splitISO,
            end_time: slice.end_time, // original end time
            notes: slice.notes // Copy notes? Or empty?
        });

        onSave();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Split Time Slice</DialogTitle>
                    <DialogDescription>
                        Choose a time to split this slice and assign the new part to a work item.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="split-time">Split Time</Label>
                        <Input
                            id="split-time"
                            type="time"
                            value={splitTime}
                            onChange={(e) => setSplitTime(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Original slice will end at this time. New slice will start here.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label>New Work Item</Label>
                        <WorkItemSearchBar onSelect={setNewItem} placeholder="Select work item for second part..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleSplit} disabled={!newItem}>Split & Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
