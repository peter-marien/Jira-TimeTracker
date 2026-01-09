import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TimeSlice } from "@/lib/api"
import { format } from "date-fns"
import { Clock, Info } from "lucide-react"

interface MergeSlicesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    slicesToMerge: TimeSlice[];
}

export function MergeSlicesDialog({ open, onOpenChange, onConfirm, slicesToMerge }: MergeSlicesDialogProps) {
    if (slicesToMerge.length < 2) return null;

    const firstSlice = slicesToMerge[0];
    const isDifferentWorkItems = slicesToMerge.some(s =>
        s.work_item_id !== firstSlice.work_item_id
    );
    const hasSyncedSlices = slicesToMerge.some(s => s.synced_to_jira === 1);

    const isBlocked = isDifferentWorkItems || hasSyncedSlices;

    // Calculate preview
    const sortedSlices = [...slicesToMerge].sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    const startTime = sortedSlices[0].start_time;
    const endTime = sortedSlices[sortedSlices.length - 1].end_time;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[500px]">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {isBlocked ? "Cannot Merge Slices" : "Merge Time Slices?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4 pt-2 text-foreground/90">
                        {isDifferentWorkItems ? (
                            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md text-destructive flex gap-3 items-start">
                                <Info className="h-5 w-5 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-semibold">Different Work Items</p>
                                    <p className="text-sm opacity-90">All selected slices must belong to the same work item to be merged.</p>
                                </div>
                            </div>
                        ) : hasSyncedSlices ? (
                            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md text-destructive flex gap-3 items-start">
                                <Info className="h-5 w-5 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-semibold">Synced Slices Selected</p>
                                    <p className="text-sm opacity-90">Slices that have already been synced to Jira cannot be merged.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p>You are about to merge {slicesToMerge.length} time slices into one.</p>

                                <div className="bg-muted p-4 rounded-lg space-y-3 border">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Time Range</p>
                                        <div className="flex items-center gap-2 font-mono text-sm font-medium">
                                            <Clock className="h-3.5 w-3.5 text-primary" />
                                            <span>{format(new Date(startTime), "HH:mm:ss")}</span>
                                            <span className="text-muted-foreground">→</span>
                                            <span>{endTime ? format(new Date(endTime), "HH:mm:ss") : "Now"}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Work Item</p>
                                        <p className="text-sm font-medium">{firstSlice.work_item_description}</p>
                                        {firstSlice.jira_key && (
                                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                {firstSlice.jira_key}
                                            </span>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-border/50">
                                        <p className="text-xs italic text-muted-foreground">Notes from all slices will be concatenated.</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Close</AlertDialogCancel>
                    {!isBlocked && (
                        <AlertDialogAction onClick={onConfirm} className="bg-primary hover:bg-primary/90">
                            Merge Slices
                        </AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
