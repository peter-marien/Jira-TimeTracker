import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { WorkItem, api } from "@/lib/api"
import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { Clock, Trash2, Plus, ArrowRight, Download, Loader2 } from "lucide-react"

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
    const [selectedAction, setSelectedAction] = useState<'discard' | 'keep' | 'reassign' | 'importJira'>('keep');
    const [targetWorkItem, setTargetWorkItem] = useState<WorkItem | null>(null);

    // Jira search state
    const [jiraQuery, setJiraQuery] = useState("");
    const [jiraResults, setJiraResults] = useState<any[]>([]);
    const [jiraLoading, setJiraLoading] = useState(false);
    const [jiraError, setJiraError] = useState<string | null>(null);
    const [selectedJiraIssue, setSelectedJiraIssue] = useState<any | null>(null);
    const [importing, setImporting] = useState(false);

    // Debounced Jira search
    useEffect(() => {
        if (selectedAction !== 'importJira' || !jiraQuery.trim()) {
            setJiraResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setJiraLoading(true);
            setJiraError(null);
            try {
                const data = await api.searchJiraIssues(jiraQuery);
                const issues = Array.isArray(data) ? data : (data.issues || []);
                setJiraResults(issues);
            } catch (err: any) {
                const msg = err.message || "Failed to search Jira.";
                setJiraError(msg.includes('default') ? "No default Jira connection configured." : msg);
                setJiraResults([]);
            } finally {
                setJiraLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [jiraQuery, selectedAction]);

    const handleSelectJiraIssue = (issue: any) => {
        setSelectedJiraIssue(issue);
        setJiraQuery(issue.key); // Show key in the input
        setJiraResults([]); // Close dropdown
    };

    const handleConfirm = async () => {
        if (selectedAction === 'reassign' && !targetWorkItem) {
            return;
        }

        if (selectedAction === 'importJira') {
            if (!selectedJiraIssue) return;

            setImporting(true);
            try {
                // Get default connection
                const connections = await api.getJiraConnections();
                const defaultConn = connections.find(c => c.is_default) || connections[0];

                if (!defaultConn) {
                    setJiraError("No Jira connection configured.");
                    setImporting(false);
                    return;
                }

                // Create work item from selected issue
                const newWorkItem = await api.saveWorkItem({
                    jira_connection_id: defaultConn.id,
                    jira_key: selectedJiraIssue.key,
                    description: selectedJiraIssue.fields.summary || selectedJiraIssue.key
                }) as WorkItem;

                // Assign away time to the new work item
                onAction('reassign', newWorkItem);
                resetAndClose();
            } catch (err) {
                setJiraError("Failed to import issue.");
                setImporting(false);
            }
            return;
        }

        onAction(selectedAction, targetWorkItem || undefined);
        resetAndClose();
    };

    const resetAndClose = () => {
        onOpenChange(false);
        setSelectedAction('keep');
        setTargetWorkItem(null);
        setJiraQuery("");
        setJiraResults([]);
        setSelectedJiraIssue(null);
        setJiraError(null);
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
                        onValueChange={(value: string) => {
                            setSelectedAction(value as typeof selectedAction);
                            // Reset Jira state when switching away
                            if (value !== 'importJira') {
                                setJiraQuery("");
                                setJiraResults([]);
                                setSelectedJiraIssue(null);
                                setJiraError(null);
                            }
                        }}
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

                        <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="importJira" id="importJira" className="mt-0.5" />
                            <div className="flex-1">
                                <Label htmlFor="importJira" className="font-medium cursor-pointer flex items-center gap-2">
                                    <Download className="h-4 w-4 text-jira" />
                                    Import from Jira
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Search for a Jira issue, create a work item, and assign time to it.
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

                    {selectedAction === 'importJira' && (
                        <div className="mt-4 space-y-2">
                            <Label>Search Jira issues:</Label>
                            <div className="relative">
                                <div className="relative">
                                    <Input
                                        value={jiraQuery}
                                        onChange={e => {
                                            setJiraQuery(e.target.value);
                                            setSelectedJiraIssue(null); // Clear selection when typing
                                        }}
                                        placeholder="Search by key or summary (e.g. PROJ-123)"
                                        className="pr-8"
                                    />
                                    {jiraLoading && (
                                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                </div>

                                {/* Autocomplete dropdown */}
                                {jiraResults.length > 0 && !selectedJiraIssue && (
                                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                                        {jiraResults.map(issue => (
                                            <div
                                                key={issue.id}
                                                role="button"
                                                tabIndex={0}
                                                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-start gap-2 cursor-pointer"
                                                onClick={() => handleSelectJiraIssue(issue)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSelectJiraIssue(issue)}
                                            >
                                                <span className="font-mono text-xs font-semibold bg-secondary px-1.5 py-0.5 rounded shrink-0">
                                                    {issue.key}
                                                </span>
                                                <span className="text-sm line-clamp-1">{issue.fields.summary}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {jiraError && (
                                <p className="text-destructive text-sm">{jiraError}</p>
                            )}

                            {selectedJiraIssue && (
                                <div className="p-2 bg-muted/50 rounded-md border text-sm">
                                    <span className="font-mono font-semibold text-primary">{selectedJiraIssue.key}</span>
                                    <span className="ml-2 text-muted-foreground">{selectedJiraIssue.fields.summary}</span>
                                </div>
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
                        disabled={
                            (selectedAction === 'reassign' && !targetWorkItem) ||
                            (selectedAction === 'importJira' && !selectedJiraIssue) ||
                            importing
                        }
                    >
                        {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
