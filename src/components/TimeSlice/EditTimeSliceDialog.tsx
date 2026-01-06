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
import { TimeSlice, api } from "@/lib/api"
import { useState, useEffect, useMemo } from "react"
import { DateTimePicker } from "@/components/shared/DateTimePicker"
import { useTrackingStore } from "@/stores/useTrackingStore"
import { formatISO, differenceInSeconds } from "date-fns"
import { Clock } from "lucide-react"

interface EditTimeSliceDialogProps {
    slice: TimeSlice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function EditTimeSliceDialog({ slice, open, onOpenChange, onSave }: EditTimeSliceDialogProps) {
    const [startDateTime, setStartDateTime] = useState<Date | undefined>(undefined)
    const [endDateTime, setEndDateTime] = useState<Date | undefined>(undefined)
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (slice && open) {
            setStartDateTime(new Date(slice.start_time))
            setEndDateTime(slice.end_time ? new Date(slice.end_time) : undefined)
            setNotes(slice.notes || "");
            setError(null);
        }
    }, [slice, open]);

    const durationString = useMemo(() => {
        if (!startDateTime || !endDateTime) return null;
        if (endDateTime <= startDateTime) return "Invalid duration";

        const seconds = differenceInSeconds(endDateTime, startDateTime);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60; // meaningful? maybe not for edit dialog, but accurate.

        if (h > 0) return `${h}h ${m}m`;
        return `${m}m` + (s > 0 ? ` ${s}s` : "");
    }, [startDateTime, endDateTime]);

    const handleSave = async () => {
        if (!slice || !startDateTime) return;
        setError(null);

        if (endDateTime && endDateTime <= startDateTime) {
            setError("End time must be after start time");
            return;
        }

        await api.saveTimeSlice({
            id: slice.id,
            work_item_id: slice.work_item_id,
            start_time: formatISO(startDateTime),
            end_time: endDateTime ? formatISO(endDateTime) : null,
            notes: notes,
            // Preserve sync-related fields
            synced_to_jira: slice.synced_to_jira,
            jira_worklog_id: slice.jira_worklog_id,
            synced_start_time: slice.synced_start_time,
            synced_end_time: slice.synced_end_time
        });

        // active slice check
        const activeTimeSliceId = useTrackingStore.getState().activeTimeSliceId;
        if (activeTimeSliceId === slice.id) {
            useTrackingStore.getState().checkActiveTracking();
        }

        onSave();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <div className="flex justify-between items-center pr-8">
                        <div>
                            <DialogTitle>Edit Time Slice</DialogTitle>
                            <DialogDescription>
                                Modify date, start/end times or notes.
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
                    {slice && (
                        <div className="bg-muted/50 p-3 rounded-md space-y-1">
                            <div className="flex items-center gap-2">
                                {slice.jira_key && (
                                    <span className="text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                        {slice.jira_key}
                                    </span>
                                )}
                                <span className="text-sm font-medium leading-none">
                                    {slice.work_item_description || "No description"}
                                </span>
                            </div>
                        </div>
                    )}
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
                        <Label htmlFor="end">End Date & Time</Label>
                        <DateTimePicker
                            value={endDateTime}
                            onChange={(date) => {
                                setEndDateTime(date);
                                setError(null);
                            }}
                            disabled={!slice?.end_time}
                            placeholder="No end time (active)"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="What were you doing?"
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
                    <Button type="button" onClick={handleSave}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
