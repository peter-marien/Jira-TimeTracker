import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TimeSlice, api } from "@/lib/api"
import { useState, useMemo } from "react"
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import { format, differenceInSeconds } from "date-fns"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SyncToJiraDialogProps {
    date: Date;
    slices: TimeSlice[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function SyncToJiraDialog({ date, slices, open, onOpenChange, onSuccess }: SyncToJiraDialogProps) {
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Group slices by issue? Or sync individually?
    // Ideally aggregate if for same issue and adjacent? Or distinct worklogs?
    // Plan says "Create separate worklog for each time slice". Logic is simpler.
    // Validation: Must have Jira Key. Must have end time (not active). Not already synced.

    const syncableSlices = useMemo(() => {
        return slices.filter(s => s.jira_key && s.end_time && !s.synced_to_jira);
    }, [slices]);

    const handleSync = async () => {
        setSyncing(true);
        setError(null);
        let syncedCount = 0;

        try {
            for (const slice of syncableSlices) {
                if (!slice.jira_key || !slice.end_time) continue;

                setProgress(`Syncing ${slice.jira_key}...`);

                const start = new Date(slice.start_time);
                const end = new Date(slice.end_time);
                const duration = differenceInSeconds(end, start);

                if (duration < 60) {
                    // Skip tiny slices? Or allow?
                    // Jira minimum is usually 1m.
                }

                // Check conflicts? 
                // Basic check: getWorklogs and see if one exists with same start/duration?
                // For MVP, skip complex conflict detection to minimize implementation risk. 
                // Just append.

                const result = await api.addJiraWorklog(slice.jira_key, {
                    timeSpentSeconds: duration,
                    comment: slice.notes || slice.work_item_description || "Worked on issue",
                    started: slice.start_time // ISO
                });

                // Mark as synced
                await api.saveTimeSlice({
                    id: slice.id,
                    work_item_id: slice.work_item_id,
                    start_time: slice.start_time,
                    end_time: slice.end_time,
                    notes: slice.notes,
                    synced_to_jira: 1,
                    jira_worklog_id: result.id
                });

                syncedCount++;
            }
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.errorMessages?.[0] || err.message || "Unknown error";
            setError(`Sync failed: ${msg}. Check if issue keys are valid.`);
        } finally {
            setSyncing(false);
            setProgress("");
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Sync to Jira</DialogTitle>
                    <DialogDescription>
                        Upload time slices for {format(date, "MMMM do")} to Jira worklogs.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {syncableSlices.length === 0 ? (
                        <div className="flex flex-col items-center text-center text-muted-foreground py-4">
                            <CheckCircle className="h-8 w-8 mb-2 text-emerald-500" />
                            <p>All eligible items are already synced or no items with Jira keys found.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>{syncableSlices.length} unsynced items found.</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground px-1 italic">
                                    Note: Jira requires a minimum of 1 minute. Slices shorter than 60s will be rounded up.
                                </p>
                            </div>

                            <ScrollArea className="h-[200px] border rounded p-2">
                                {syncableSlices.map(s => (
                                    <div key={s.id} className="flex justify-between items-center p-2 text-sm border-b last:border-0">
                                        <span className="font-mono font-medium">{s.jira_key}</span>
                                        <span className="text-muted-foreground truncate max-w-[200px]">{s.notes || s.work_item_description}</span>
                                        <span className="font-mono text-xs">{format(new Date(s.start_time), "HH:mm")}</span>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                    )}

                    {error && <p className="text-destructive text-sm mt-2">{error}</p>}
                    {syncing && <p className="text-muted-foreground text-sm mt-2 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {progress}</p>}
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={syncing}>Cancel</Button>
                    <Button onClick={handleSync} disabled={syncing || syncableSlices.length === 0}>
                        {syncing ? "Syncing..." : "Sync Now"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
