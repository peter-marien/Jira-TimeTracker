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
import { useState, useEffect } from "react"
import { format, differenceInMinutes, addMinutes, isBefore, isAfter } from "date-fns"
import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { TimePicker } from "@/components/shared/TimePicker"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, AlertCircle } from "lucide-react"
import { useTrackingStore } from "@/stores/useTrackingStore"

interface SplitSegment {
    id: string;
    startTime: string; // HH:mm:ss
    endTime: string;   // HH:mm:ss
    workItem: WorkItem | null;
}

interface SplitTimeSliceDialogProps {
    slice: TimeSlice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function SplitTimeSliceDialog({ slice, open, onOpenChange, onSave }: SplitTimeSliceDialogProps) {
    const [segments, setSegments] = useState<SplitSegment[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (slice && open) {
            // Default: one segment in the middle

            // Initial default segment: 5m in the middle
            const startDate = new Date(slice.start_time);
            const endDate = slice.end_time ? new Date(slice.end_time) : new Date();
            const diff = differenceInMinutes(endDate, startDate);
            const midStart = addMinutes(startDate, Math.max(0, (diff / 2) - 5));
            const midEnd = addMinutes(midStart, Math.min(diff, 10));

            setSegments([{
                id: Math.random().toString(36).substr(2, 9),
                startTime: format(midStart, "HH:mm:ss"),
                endTime: format(midEnd, "HH:mm:ss"),
                workItem: null
            }]);
            setError(null);
        }
    }, [slice, open]);

    const addSegment = () => {
        if (!slice) return;
        const lastSegments = segments[segments.length - 1];
        const lastEnd = lastSegments ? lastSegments.endTime : "00:00:00";

        setSegments([...segments, {
            id: Math.random().toString(36).substr(2, 9),
            startTime: lastEnd,
            endTime: lastEnd, // User will adjust
            workItem: null
        }]);
    };

    const removeSegment = (id: string) => {
        setSegments(segments.filter(s => s.id !== id));
    };

    const updateSegment = (id: string, updates: Partial<SplitSegment>) => {
        setSegments(segments.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const validate = () => {
        if (!slice) return false;
        const dateBase = format(new Date(slice.start_time), "yyyy-MM-dd");
        const sliceStart = new Date(slice.start_time);
        const sliceEnd = slice.end_time ? new Date(slice.end_time) : new Date();

        // Sort segments by start time
        const sorted = [...segments].sort((a, b) => a.startTime.localeCompare(b.startTime));

        for (let i = 0; i < sorted.length; i++) {
            const s = sorted[i];
            const start = new Date(`${dateBase}T${s.startTime}`);

            // Check start time range
            if (isBefore(start, sliceStart)) {
                setError("Segment cannot start before original slice.");
                return false;
            }

            // End Time Checks
            if (s.endTime) {
                const end = new Date(`${dateBase}T${s.endTime}`);

                if (isAfter(end, sliceEnd) && slice.end_time) {
                    setError("Segments must be within original time range.");
                    return false;
                }

                if (!isBefore(start, end)) {
                    setError("Segment end time must be after start time.");
                    return false;
                }
            } else {
                // Empty End Time (Open/Active)
                // ONLY allowed if:
                // 1. Original slice is active (!slice.end_time).
                // 2. This is the LAST segment.
                if (slice.end_time) {
                    setError("Cannot have open-ended segment on a completed time slice.");
                    return false;
                }
                if (i !== sorted.length - 1) {
                    setError("Only the last segment can be open-ended.");
                    return false;
                }
            }

            if (!s.workItem) {
                setError("Each segment must have a work item assigned.");
                return false;
            }

            // Check overlap
            if (i > 0) {
                const prev = sorted[i - 1];
                if (!prev.endTime) {
                    setError("Invalid segment configuration (internal error).");
                    return false;
                }
                if (s.startTime < prev.endTime) {
                    setError("Segments cannot overlap.");
                    return false;
                }
            }
        }

        setError(null);
        return true;
    };

    const handleSplit = async () => {
        if (!slice || !validate()) return;

        const dateBase = format(new Date(slice.start_time), "yyyy-MM-dd");
        const originalStart = slice.start_time;
        const originalEnd = slice.end_time || new Date().toISOString();
        const originalWorkItemId = slice.work_item_id;

        // 1. Calculate all intervals (gaps + segments)
        const sorted = [...segments].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const finalSlices: { start: string, end: string | null, itemId: number, notes?: string }[] = [];

        let currentPos = originalStart;

        for (const seg of sorted) {
            const segStartISO = `${dateBase}T${seg.startTime}`;

            // Gap
            if (isAfter(new Date(segStartISO), new Date(currentPos))) {
                finalSlices.push({
                    start: currentPos,
                    end: segStartISO,
                    itemId: originalWorkItemId,
                    notes: slice.notes || undefined
                });
            }

            // Segment
            if (seg.endTime) {
                const segEndISO = `${dateBase}T${seg.endTime}`;
                finalSlices.push({
                    start: segStartISO,
                    end: segEndISO,
                    itemId: seg.workItem!.id,
                });
                currentPos = segEndISO;
            } else {
                // Open-ended segment!
                finalSlices.push({
                    start: segStartISO,
                    end: null, // Active
                    itemId: seg.workItem!.id,
                });
                currentPos = "FUTURE";
            }
        }

        // Final Gap
        if (currentPos !== "FUTURE" && isAfter(new Date(originalEnd), new Date(currentPos))) {
            finalSlices.push({
                start: currentPos,
                end: originalEnd,
                itemId: originalWorkItemId,
                notes: slice.notes || undefined
            });
        }

        // 2. Perform DB operations
        // We delete original and insert all new ones
        await api.deleteTimeSlice(slice.id);

        for (const f of finalSlices) {
            await api.saveTimeSlice({
                work_item_id: f.itemId,
                start_time: f.start,
                end_time: f.end || undefined,
                notes: f.notes
            });
        }

        // If we modified the active slice (original was active OR we created a new active one)
        // we must update the global tracking store to point to the new ID (or null).
        if (!slice.end_time || finalSlices.some(f => !f.end)) {
            await useTrackingStore.getState().checkActiveTracking();
        }

        onSave();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Advanced Split</DialogTitle>
                    <DialogDescription>
                        Extract one or more segments from this time slice. Unassigned time stays on the original work item.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6 py-4">
                        {segments.map((seg, index) => (
                            <div key={seg.id} className="p-4 border rounded-lg bg-accent/20 relative group">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeSegment(seg.id)}
                                >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>

                                <div className="grid gap-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Segment {index + 1}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Start Time</Label>
                                            <TimePicker
                                                value={seg.startTime}
                                                onChange={(val) => updateSegment(seg.id, { startTime: val })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">End Time</Label>
                                            <TimePicker
                                                value={seg.endTime}
                                                onChange={(val) => updateSegment(seg.id, { endTime: val })}
                                                allowEmpty={!slice?.end_time && index === segments.length - 1}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Work Item</Label>
                                        <WorkItemSearchBar
                                            onSelect={(item) => updateSegment(seg.id, { workItem: item })}
                                            placeholder="Assign to..."
                                        />
                                        {seg.workItem && (
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                                                Selected: <span className="font-medium text-foreground">{seg.workItem.description}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            className="w-full border-dashed"
                            onClick={addSegment}
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Another Segment
                        </Button>
                    </div>
                </ScrollArea>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 items-center">
                    {error && (
                        <div className="flex items-center gap-2 text-destructive text-xs flex-1 animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="h-3 w-3" />
                            {error}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSplit}>Apply Split</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
