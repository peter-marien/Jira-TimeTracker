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
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useState, useEffect, useMemo } from "react"
import { DateTimePicker } from "@/components/shared/DateTimePicker"
import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { formatISO, differenceInSeconds } from "date-fns"
import { Clock } from "lucide-react"

interface AddTimeSliceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    selectedDate: Date;
}

export function AddTimeSliceDialog({ open, onOpenChange, onSave, selectedDate }: AddTimeSliceDialogProps) {
    const [workItemId, setWorkItemId] = useState<number | null>(null)
    const [startDateTime, setStartDateTime] = useState<Date | undefined>(undefined)
    const [endDateTime, setEndDateTime] = useState<Date | undefined>(undefined)
    const [notes, setNotes] = useState("")
    const [error, setError] = useState<string | null>(null)

    // Initialize with selected date at current time when dialog opens
    useEffect(() => {
        if (open) {
            const now = new Date()
            const dateAtCurrentTime = new Date(selectedDate)
            dateAtCurrentTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0)

            setStartDateTime(dateAtCurrentTime)
            setEndDateTime(undefined)
            setWorkItemId(null)
            setNotes("")
            setError(null)
        }
    }, [open, selectedDate])

    const durationString = useMemo(() => {
        if (!startDateTime || !endDateTime) return null;
        if (endDateTime <= startDateTime) return "Invalid duration";

        const seconds = differenceInSeconds(endDateTime, startDateTime);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) return `${h}h ${m}m`;
        return `${m}m` + (s > 0 ? ` ${s}s` : "");
    }, [startDateTime, endDateTime]);

    const handleSave = async () => {
        if (!workItemId || !startDateTime) return
        setError(null);

        if (endDateTime && endDateTime <= startDateTime) {
            setError("End time must be after start time");
            return;
        }

        await api.saveTimeSlice({
            work_item_id: workItemId,
            start_time: formatISO(startDateTime),
            end_time: endDateTime ? formatISO(endDateTime) : null,
            notes: notes || null,
        })

        onSave()
        onOpenChange(false)
    }

    const canSubmit = workItemId !== null && startDateTime !== undefined

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex justify-between items-center pr-8">
                        <div>
                            <DialogTitle>Add Time Slice</DialogTitle>
                            <DialogDescription>
                                Manually add a time entry for {selectedDate.toLocaleDateString()}.
                            </DialogDescription>
                        </div>
                        {durationString && (
                            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full text-sm font-mono border">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{durationString}</span>
                            </div>
                        )}
                    </div>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="workitem">Work Item</Label>
                        <WorkItemSearchBar
                            onSelect={(item) => {
                                setWorkItemId(item.id);
                                setError(null);
                            }}
                            placeholder="Search for work item..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="start">Start Date & Time</Label>
                        <DateTimePicker
                            value={startDateTime}
                            onChange={(date) => {
                                setStartDateTime(date);
                                setError(null);
                            }}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="end">End Date & Time (Optional)</Label>
                        <DateTimePicker
                            value={endDateTime}
                            onChange={(date) => {
                                setEndDateTime(date);
                                setError(null);
                            }}
                            placeholder="Leave empty for active slice"
                            defaultMonth={startDateTime}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="What were you working on?"
                            rows={3}
                        />
                    </div>
                    {error && (
                        <div className="text-red-500 text-sm font-medium">
                            {error}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSubmit}
                    >
                        Add Time Slice
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
