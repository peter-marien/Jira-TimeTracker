import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api, TimeSlice, WorkItem } from "@/lib/api"
import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { TimeSliceTable } from "@/views/Dashboard/TimeSliceTable"
import { useDateStore } from "@/stores/useDateStore"
import { useNavigate } from "react-router-dom"
import { EditTimeSliceDialog } from "@/components/TimeSlice/EditTimeSliceDialog"
import { SplitTimeSliceDialog } from "@/components/TimeSlice/SplitTimeSliceDialog"
import { MoveTimeSliceDialog } from "@/components/TimeSlice/MoveTimeSliceDialog"
import { CopyTimeSliceDialog } from "@/components/TimeSlice/CopyTimeSliceDialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { useTrackingStore } from "@/stores/useTrackingStore"

interface WorkItemTimeSlicesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workItem: WorkItem | null;
}

export function WorkItemTimeSlicesDialog({ open, onOpenChange, workItem }: WorkItemTimeSlicesDialogProps) {
    const [slices, setSlices] = useState<TimeSlice[]>([]);
    const [loading, setLoading] = useState(false);
    const { setSelectedDate } = useDateStore();
    const navigate = useNavigate();

    // Dialog States
    const [editSlice, setEditSlice] = useState<TimeSlice | null>(null);
    const [splitSlice, setSplitSlice] = useState<TimeSlice | null>(null);
    const [moveSlice, setMoveSlice] = useState<TimeSlice | null>(null);
    const [deleteSlice, setDeleteSlice] = useState<TimeSlice | null>(null);
    const [copySlice, setCopySlice] = useState<TimeSlice | null>(null);

    const fetchSlices = useCallback(() => {
        if (workItem) {
            setLoading(true);
            api.getTimeSlicesForWorkItem(workItem.id)
                .then(setSlices)
                .catch(err => console.error("Failed to fetch slices:", err))
                .finally(() => setLoading(false));
        }
    }, [workItem]);

    useEffect(() => {
        if (open && workItem) {
            fetchSlices();
        }
    }, [open, workItem, fetchSlices]);

    const handleEdit = (slice: TimeSlice) => setEditSlice(slice);
    const handleSplit = (slice: TimeSlice) => setSplitSlice(slice);
    const handleMove = (slice: TimeSlice) => setMoveSlice(slice);
    const handleDelete = (slice: TimeSlice) => setDeleteSlice(slice);
    const handleCopy = (slice: TimeSlice) => setCopySlice(slice);
    const handleResume = async (slice: TimeSlice) => {
        const { startTracking } = useTrackingStore.getState();
        try {
            const wi = await api.getWorkItem(slice.work_item_id);
            if (wi) {
                await startTracking(wi);
                fetchSlices();
            }
        } catch (err) {
            console.error("Failed to resume tracking", err);
        }
    };

    const confirmDelete = async () => {
        if (deleteSlice) {
            await api.deleteTimeSlice(deleteSlice.id);
            setDeleteSlice(null);
            fetchSlices();
        }
    };

    const handleDoubleClick = (slice: TimeSlice) => {
        const date = new Date(slice.start_time);
        setSelectedDate(date);
        navigate("/");
        onOpenChange(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Time Slices for Work Item</DialogTitle>
                        <DialogDescription>
                            {workItem?.jira_key ? `[${workItem.jira_key}] ` : ''}
                            {workItem?.description}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden mt-4">
                        <ScrollArea className="h-full pr-4" onWheel={(e) => e.stopPropagation()}>
                            {loading ? (
                                <div className="flex items-center justify-center h-40">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : slices.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border rounded-md">
                                    <p>No time slices recorded yet.</p>
                                </div>
                            ) : (
                                <TimeSliceTable
                                    slices={slices}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onSplit={handleSplit}
                                    onMove={handleMove}
                                    onResume={handleResume}
                                    onCopy={handleCopy}
                                    onDoubleClick={handleDoubleClick}
                                    showDate={true}
                                />
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            <EditTimeSliceDialog
                open={!!editSlice}
                onOpenChange={(open) => !open && setEditSlice(null)}
                slice={editSlice}
                onSave={fetchSlices}
            />
            <SplitTimeSliceDialog
                open={!!splitSlice}
                onOpenChange={(open) => !open && setSplitSlice(null)}
                slice={splitSlice}
                onSave={fetchSlices}
            />
            <MoveTimeSliceDialog
                open={!!moveSlice}
                onOpenChange={(open) => !open && setMoveSlice(null)}
                slice={moveSlice}
                onSave={fetchSlices}
            />
            <CopyTimeSliceDialog
                open={!!copySlice}
                onOpenChange={(open) => !open && setCopySlice(null)}
                slice={copySlice}
                onSave={fetchSlices}
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
        </>
    );
}
