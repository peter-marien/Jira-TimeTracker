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
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { TimeSlice, api } from "@/lib/api"
import { useState, useEffect } from "react"
import { formatISO, set } from "date-fns"

interface CopyTimeSliceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    slice: TimeSlice | null;
    onSave: () => void;
}

export function CopyTimeSliceDialog({ open, onOpenChange, slice, onSave }: CopyTimeSliceDialogProps) {
    const [selectedDates, setSelectedDates] = useState<Date[] | undefined>([])
    const [includeNotes, setIncludeNotes] = useState(true)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setSelectedDates([])
            setIncludeNotes(true)
            setLoading(false)
        }
    }, [open])

    const handleCopy = async () => {
        if (!slice || !selectedDates || selectedDates.length === 0) return

        setLoading(true)
        try {
            const sourceStart = new Date(slice.start_time)
            const sourceEnd = slice.end_time ? new Date(slice.end_time) : null

            for (const date of selectedDates) {
                // Apply the exact time from the source slice to the new date
                const newStart = set(date, {
                    hours: sourceStart.getHours(),
                    minutes: sourceStart.getMinutes(),
                    seconds: sourceStart.getSeconds(),
                    milliseconds: 0
                })

                let newEnd = null
                if (sourceEnd) {
                    newEnd = set(date, {
                        hours: sourceEnd.getHours(),
                        minutes: sourceEnd.getMinutes(),
                        seconds: sourceEnd.getSeconds(),
                        milliseconds: 0
                    })
                }

                await api.saveTimeSlice({
                    work_item_id: slice.work_item_id,
                    start_time: formatISO(newStart),
                    end_time: newEnd ? formatISO(newEnd) : null,
                    notes: includeNotes ? slice.notes : null
                })
            }
            onSave()
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to copy slices", error)
        } finally {
            setLoading(false)
        }
    }

    if (!slice) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Copy Time Slice</DialogTitle>
                    <DialogDescription>
                        Select one or more days to copy this time entry to.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Work Item</span>
                        <div className="flex flex-col">
                            {slice.jira_key && <span className="text-primary font-mono text-xs">{slice.jira_key}</span>}
                            <span className="text-sm font-medium truncate">{slice.work_item_description}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 items-center">
                        <Calendar
                            mode="multiple"
                            selected={selectedDates}
                            onSelect={setSelectedDates}
                            className="rounded-md border shadow-sm"
                        />
                    </div>

                    <div className="flex items-center justify-between px-1">
                        <div className="flex flex-col gap-0.5">
                            <Label htmlFor="include-notes">Include Notes</Label>
                            <span className="text-[11px] text-muted-foreground">Copy descriptions and details</span>
                        </div>
                        <Switch
                            id="include-notes"
                            checked={includeNotes}
                            onCheckedChange={setIncludeNotes}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        onClick={handleCopy}
                        disabled={!selectedDates?.length || loading}
                    >
                        {loading ? "Copying..." : `Copy to ${selectedDates?.length || 0} ${selectedDates?.length === 1 ? 'day' : 'days'}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
