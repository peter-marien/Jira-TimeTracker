import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api, TimeSlice, WorkItem } from "@/lib/api"
import { useEffect, useState } from "react"
import { TimeDisplay } from "@/components/shared/TimeDisplay"
import { DurationDisplay } from "@/components/shared/DurationDisplay"
import { differenceInSeconds, format } from "date-fns"
import { Loader2 } from "lucide-react"

interface WorkItemTimeSlicesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workItem: WorkItem | null;
}

export function WorkItemTimeSlicesDialog({ open, onOpenChange, workItem }: WorkItemTimeSlicesDialogProps) {
    const [slices, setSlices] = useState<TimeSlice[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && workItem) {
            setLoading(true);
            api.getTimeSlicesForWorkItem(workItem.id)
                .then(setSlices)
                .catch(err => console.error("Failed to fetch slices:", err))
                .finally(() => setLoading(false));
        }
    }, [open, workItem]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Time Slices for Work Item</DialogTitle>
                    <DialogDescription>
                        {workItem?.jira_key ? `[${workItem.jira_key}] ` : ''}
                        {workItem?.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden border rounded-md mt-4">
                    <ScrollArea className="h-full">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : slices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                <p>No time slices recorded yet.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="sticky top-0 bg-secondary/50 backdrop-blur-sm z-10">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead className="text-right">Duration</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {slices.map((slice) => {
                                        const start = new Date(slice.start_time);
                                        const end = slice.end_time ? new Date(slice.end_time) : null;
                                        const durationSeconds = end ? differenceInSeconds(end, start) : differenceInSeconds(new Date(), start);

                                        return (
                                            <TableRow key={slice.id}>
                                                <TableCell className="font-mono text-xs whitespace-nowrap">
                                                    {format(start, "yyyy-MM-dd")}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <TimeDisplay date={start} />
                                                        <span className="text-muted-foreground">-</span>
                                                        {end ? <TimeDisplay date={end} /> : <span className="text-emerald-500 font-medium">Active</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono-data">
                                                    <DurationDisplay seconds={durationSeconds} />
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                                    {slice.notes || "-"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
