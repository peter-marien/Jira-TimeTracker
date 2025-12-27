import { DateNavigation } from "./DateNavigation"
import { QuickStartBar } from "./QuickStartBar"
import { TimeSliceTable } from "./TimeSliceTable"
import { Timeline } from "./Timeline"
import { ActiveTrackingBanner } from "./ActiveTrackingBanner"
import { useDateStore } from "@/stores/useDateStore"
import { useTrackingStore } from "@/stores/useTrackingStore"
import { useTimeSlices } from "@/hooks/useTimeSlices"
import { TimeSlice, api } from "@/lib/api"
import { useState, useEffect } from "react"
import { EditTimeSliceDialog } from "@/components/TimeSlice/EditTimeSliceDialog"
import { SplitTimeSliceDialog } from "@/components/TimeSlice/SplitTimeSliceDialog"
import { MoveTimeSliceDialog } from "@/components/TimeSlice/MoveTimeSliceDialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { SyncToJiraDialog } from "@/components/Sync/SyncToJiraDialog"
import { ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Dashboard() {
    const { selectedDate } = useDateStore();
    const { slices, loading, refresh } = useTimeSlices(selectedDate);
    const activeTimeSliceId = useTrackingStore(state => state.activeTimeSliceId);

    // Refresh list when tracking starts/stops
    useEffect(() => {
        refresh();
    }, [activeTimeSliceId, refresh]);

    // Dialog States
    const [editSlice, setEditSlice] = useState<TimeSlice | null>(null);
    const [splitSlice, setSplitSlice] = useState<TimeSlice | null>(null);
    const [moveSlice, setMoveSlice] = useState<TimeSlice | null>(null);
    const [deleteSlice, setDeleteSlice] = useState<TimeSlice | null>(null);
    const [syncOpen, setSyncOpen] = useState(false);

    // Handlers
    const handleEdit = (slice: TimeSlice) => setEditSlice(slice);
    const handleSplit = (slice: TimeSlice) => setSplitSlice(slice);
    const handleMove = (slice: TimeSlice) => setMoveSlice(slice);
    const handleDelete = (slice: TimeSlice) => setDeleteSlice(slice);

    const confirmDelete = async () => {
        if (deleteSlice) {
            await api.deleteTimeSlice(deleteSlice.id);
            setDeleteSlice(null);
            refresh();
        }
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <ActiveTrackingBanner />

            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
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

                <QuickStartBar />

                <Timeline date={selectedDate} slices={slices} />

                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Time Slices</h2>
                    {loading ? (
                        <div className="p-10 text-center text-muted-foreground animate-pulse">Loading...</div>
                    ) : (
                        <TimeSliceTable
                            slices={slices}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onSplit={handleSplit}
                            onMove={handleMove}
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
            <ConfirmDialog
                open={!!deleteSlice}
                onOpenChange={(open) => !open && setDeleteSlice(null)}
                onConfirm={confirmDelete}
                title="Delete Time Slice?"
                description="This action cannot be undone."
                variant="destructive"
                confirmText="Delete"
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
