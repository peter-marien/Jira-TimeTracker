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
// import { Textarea } from "@/components/ui/textarea"
import { TimeSlice, api } from "@/lib/api"
import { useState, useEffect } from "react"
import { format } from "date-fns"

interface EditTimeSliceDialogProps {
    slice: TimeSlice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function EditTimeSliceDialog({ slice, open, onOpenChange, onSave }: EditTimeSliceDialogProps) {
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (slice && open) {
            setStartTime(format(new Date(slice.start_time), "HH:mm"));
            setEndTime(slice.end_time ? format(new Date(slice.end_time), "HH:mm") : "");
            setNotes(slice.notes || "");
        }
    }, [slice, open]);

    const handleSave = async () => {
        if (!slice) return;

        // Reconstruct ISO strings
        // We assume date is same as original start_time date
        // If time crosses midnight, this logic needs improvement (using full datetime picker).
        // For MVP, assume same day.

        const dateBase = slice.start_time.split('T')[0];
        const newStart = `${dateBase}T${startTime}:00`;
        const newEnd = endTime ? `${dateBase}T${endTime}:00` : null; // Handles removing end time? If empty string, maybe null?

        // If endTime is empty string, does it mean active? 
        // If slice was closed, can we re-open it? 
        // Usually "Edit" implies correcting times.
        // If user clears end time, we could set it to null (active).

        await api.saveTimeSlice({
            id: slice.id,
            work_item_id: slice.work_item_id,
            start_time: newStart,
            end_time: newEnd || null,
            notes: notes
        });

        onSave();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Time Slice</DialogTitle>
                    <DialogDescription>
                        Modify start/end times or notes.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="start">Start Time</Label>
                            <Input
                                id="start"
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="end">End Time</Label>
                            <Input
                                id="end"
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="What were you doing?"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleSave}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
