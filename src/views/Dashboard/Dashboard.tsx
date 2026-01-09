import { DateNavigation } from "./DateNavigation"
import { QuickStartBar } from "./QuickStartBar"
import { TimeSliceTable } from "./TimeSliceTable"
import { Timeline } from "./Timeline"
import { ActiveTrackingBanner } from "./ActiveTrackingBanner"
import { useDateStore } from "@/stores/useDateStore"
import { useTrackingStore } from "@/stores/useTrackingStore"
import { useTimeSlices } from "@/hooks/useTimeSlices"
import { TimeSlice, api } from "@/lib/api"
import { useState, useEffect, useRef, useMemo } from "react"
import { EditTimeSliceDialog } from "@/components/TimeSlice/EditTimeSliceDialog"
import { AddTimeSliceDialog } from "@/components/TimeSlice/AddTimeSliceDialog"
import { SplitTimeSliceDialog } from "@/components/TimeSlice/SplitTimeSliceDialog"
import { MoveTimeSliceDialog } from "@/components/TimeSlice/MoveTimeSliceDialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { SyncToJiraDialog } from "@/components/Sync/SyncToJiraDialog"
import { CopyTimeSliceDialog } from "@/components/TimeSlice/CopyTimeSliceDialog"
import { MergeSlicesDialog } from "@/components/shared/MergeSlicesDialog"
import { ArrowLeftRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Dashboard() {
    const { selectedDate } = useDateStore();
    const { slices, loading, refresh } = useTimeSlices(selectedDate);
    const activeTimeSliceId = useTrackingStore(state => state.activeTimeSliceId);
    const prevActiveIdRef = useRef<number | null>(activeTimeSliceId);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Dialog States
    const [editSlice, setEditSlice] = useState<TimeSlice | null>(null);
    const [addSliceOpen, setAddSliceOpen] = useState(false);
    const [splitSlice, setSplitSlice] = useState<TimeSlice | null>(null);
    const [moveSlice, setMoveSlice] = useState<TimeSlice | null>(null);
    const [deleteSlice, setDeleteSlice] = useState<TimeSlice | null>(null);
    const [copySlice, setCopySlice] = useState<TimeSlice | null>(null);
    const [syncOpen, setSyncOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);

    // Refresh list when tracking starts/stops
    // AND detection of when timing stops to prompt for notes
    useEffect(() => {
        if (prevActiveIdRef.current && !activeTimeSliceId) {
            // Tracking just stopped!
            const lastId = prevActiveIdRef.current;
            api.getTimeSlice(lastId).then(slice => {
                if (slice) setEditSlice(slice);
            });
        }
        prevActiveIdRef.current = activeTimeSliceId;
        refresh();
        setSelectedIds(new Set()); // Clear selection on refresh
    }, [activeTimeSliceId, refresh]);

    // Clear selection when date changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [selectedDate]);

    // Handlers
    const handleEdit = (slice: TimeSlice) => setEditSlice(slice);
    const handleSplit = (slice: TimeSlice) => setSplitSlice(slice);
    const handleMove = (slice: TimeSlice) => setMoveSlice(slice);
    const handleDelete = (slice: TimeSlice) => setDeleteSlice(slice);
    const handleCopy = (slice: TimeSlice) => setCopySlice(slice);
    const handleResume = async (slice: TimeSlice) => {
        const { startTracking } = useTrackingStore.getState();
        try {
            const workItem = await api.getWorkItem(slice.work_item_id);
            if (workItem) {
                await startTracking(workItem);
                refresh();
            }
        } catch (err) {
            console.error("Failed to resume tracking", err);
        }
    };

    const confirmDelete = async () => {
        if (deleteSlice) {
            await api.deleteTimeSlice(deleteSlice.id);
            setDeleteSlice(null);
            refresh();
        }
    }

    const confirmMerge = async () => {
        const ids = Array.from(selectedIds);
        try {
            await api.mergeTimeSlices(ids);
            setMergeOpen(false);
            setSelectedIds(new Set());
            refresh();
        } catch (err) {
            console.error("Failed to merge slices", err);
        }
    }

    // Keep track of "now" to update active durations
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    // Calculate total time for the day
    const totalTime = useMemo(() => {
        let totalMinutes = 0;
        for (const slice of slices) {
            if (slice.start_time) {
                const start = new Date(slice.start_time).getTime();
                const end = slice.end_time ? new Date(slice.end_time).getTime() : now.getTime();
                // Avoid negative durations if start is in future (unlikely but safe)
                const duration = Math.max(0, end - start);
                totalMinutes += duration / (1000 * 60);
            }
        }
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return {
            hours,
            minutes,
            totalMinutes,
            formatted: `${hours}h ${minutes.toString().padStart(2, '0')}m`
        };
    }, [slices, now]);

    const selectedSlices = useMemo(() => {
        return slices.filter(s => selectedIds.has(s.id));
    }, [slices, selectedIds]);

    return (
        <div className="flex flex-col h-full bg-background">
            <ActiveTrackingBanner />

            <div className="flex-1 p-6 space-y-6 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSyncOpen(true)}
                            className="text-primary hover:text-primary hover:bg-primary/5"
                        >
                            <ArrowLeftRight className="h-4 w-4 mr-2" /> Sync to Jira
                        </Button>
                        <DateNavigation />
                    </div>
                </div>

                <QuickStartBar totalMinutes={totalTime.totalMinutes} />

                <Timeline date={selectedDate} slices={slices} onSliceClick={handleEdit} />

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Time Slices</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddSliceOpen(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Time Slice
                        </Button>
                    </div>
                    {loading ? (
                        <div className="p-10 text-center text-muted-foreground animate-pulse">Loading...</div>
                    ) : (
                        <TimeSliceTable
                            slices={slices}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onSplit={handleSplit}
                            onMove={handleMove}
                            onResume={handleResume}
                            onCopy={handleCopy}
                            onMerge={() => setMergeOpen(true)}
                        />
                    )}
                </div>
            </div>

            <EditTimeSliceDialog
                open={!!editSlice}
                onOpenChange={(open) => !open && setEditSlice(null)}
                slice={editSlice}
                onSave={refresh}
            />
            <AddTimeSliceDialog
                open={addSliceOpen}
                onOpenChange={setAddSliceOpen}
                selectedDate={selectedDate}
                onSave={refresh}
            />
            <SplitTimeSliceDialog
                open={!!splitSlice}
                onOpenChange={(open) => !open && setSplitSlice(null)}
                slice={splitSlice}
                onSave={refresh}
            />
            <MoveTimeSliceDialog
                open={!!moveSlice}
                onOpenChange={(open) => !open && setMoveSlice(null)}
                slice={moveSlice}
                onSave={refresh}
            />
            <CopyTimeSliceDialog
                open={!!copySlice}
                onOpenChange={(open) => !open && setCopySlice(null)}
                slice={copySlice}
                onSave={refresh}
            />
            <ConfirmDialog
                open={!!deleteSlice}
                onOpenChange={(open) => !open && setDeleteSlice(null)}
                onConfirm={confirmDelete}
                title="Delete Time Slice?"
                description="This action cannot be undone."
                variant="destructive"
                confirmText="Delete"
            />

            <MergeSlicesDialog
                open={mergeOpen}
                onOpenChange={setMergeOpen}
                slicesToMerge={selectedSlices}
                onConfirm={confirmMerge}
            />

            <SyncToJiraDialog
                open={syncOpen}
                onOpenChange={setSyncOpen}
                date={selectedDate}
                slices={slices}
                onSuccess={refresh}
            />
        </div>
    )
}
