import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { WorkItem } from "@/lib/api"
import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { Clock, Trash2, Plus, ArrowRight } from "lucide-react"

interface AwayTimeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    awayDurationSeconds: number;
    awayStartTime: string;
    currentWorkItem: WorkItem | null;
    onAction: (action: 'discard' | 'keep' | 'reassign', targetWorkItem?: WorkItem) => void;
}

export function AwayTimeDialog({
    open,
    onOpenChange,
    awayDurationSeconds,
    currentWorkItem,
    onAction
}: AwayTimeDialogProps) {
    const [selectedAction, setSelectedAction] = useState<'discard' | 'keep' | 'reassign'>('keep');
    const [targetWorkItem, setTargetWorkItem] = useState<WorkItem | null>(null);

    const handleConfirm = () => {
        if (selectedAction === 'reassign' && !targetWorkItem) {
            return; // Don't allow confirm without selecting a work item
        }
        onAction(selectedAction, targetWorkItem || undefined);
        onOpenChange(false);
        // Reset state
        setSelectedAction('keep');
        setTargetWorkItem(null);
    };

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes} minutes`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        You Were Away
                    </DialogTitle>
                    <DialogDescription>
                        You were away for <strong>{formatDuration(awayDurationSeconds)}</strong> while tracking
                        {currentWorkItem && (
                            <span className="font-medium"> "{currentWorkItem.description}"</span>
                        )}.
                        <br />
                        What would you like to do with this time?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <RadioGroup
                        value={selectedAction}
                        onValueChange={(value: string) => setSelectedAction(value as typeof selectedAction)}
                        className="space-y-3"
                    >
                        <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="keep" id="keep" className="mt-0.5" />
                            <div className="flex-1">
                                <Label htmlFor="keep" className="font-medium cursor-pointer flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-green-500" />
                                    Add to current task
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Keep the away time as part of your current tracking.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="discard" id="discard" className="mt-0.5" />
                            <div className="flex-1">
                                <Label htmlFor="discard" className="font-medium cursor-pointer flex items-center gap-2">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    Discard away time
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    End your previous tracking when you left and start fresh now.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="reassign" id="reassign" className="mt-0.5" />
                            <div className="flex-1">
                                <Label htmlFor="reassign" className="font-medium cursor-pointer flex items-center gap-2">
                                    <ArrowRight className="h-4 w-4 text-blue-500" />
                                    Add to a different task
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Assign the away time to another work item.
                                </p>
                            </div>
                        </div>
                    </RadioGroup>

                    {selectedAction === 'reassign' && (
                        <div className="mt-4 space-y-2">
                            <Label>Select work item for away time:</Label>
                            <WorkItemSearchBar
                                onSelect={setTargetWorkItem}
                                placeholder="Search for a work item..."
                            />
                            {targetWorkItem && (
                                <p className="text-sm text-muted-foreground">
                                    Selected: <span className="font-medium">{targetWorkItem.description}</span>
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={selectedAction === 'reassign' && !targetWorkItem}
                    >
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
