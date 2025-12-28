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
import { useState, useEffect } from "react"
import { DateTimePicker } from "@/components/shared/DateTimePicker"
import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { formatISO } from "date-fns"

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
        }
    }, [open, selectedDate])

    const handleSave = async () => {
        if (!workItemId || !startDateTime) return

        await api.saveTimeSlice({
            work_item_id: workItemId,
            start_time: formatISO(startDateTime),
            end_time: endDateTime ? formatISO(endDateTime) : null,
            notes: notes || null,
        })

        onSave()
        onOpenChange(false)
    }

    const canSave = workItemId !== null && startDateTime !== undefined

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Time Slice</DialogTitle>
                    <DialogDescription>
                        Manually add a time entry for {selectedDate.toLocaleDateString()}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="workitem">Work Item</Label>
                        <WorkItemSearchBar
                            onSelect={(item: any) => setWorkItemId(item.id)}
                            placeholder="Search for work item..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="start">Start Date & Time</Label>
                        <DateTimePicker
                            value={startDateTime}
                            onChange={setStartDateTime}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="end">End Date & Time (Optional)</Label>
                        <DateTimePicker
                            value={endDateTime}
                            onChange={setEndDateTime}
                            placeholder="Leave empty for active slice"
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
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave}
                    >
                        Add Time Slice
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
