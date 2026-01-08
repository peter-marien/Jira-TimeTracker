import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Loader2, Plus, X } from "lucide-react"

interface ImportFromJiraDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: () => void;
}

export function ImportFromJiraDialog({ open, onOpenChange, onImport }: ImportFromJiraDialogProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<{ id: string; key: string; fields: { summary: string } }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIssue, setSelectedIssue] = useState<{ id: string; key: string; fields: { summary: string } } | null>(null);
    const [importing, setImporting] = useState(false);

    // Debounced search as you type
    useEffect(() => {
        if (!query.trim() || selectedIssue) {
            setResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await api.searchJiraIssues(query);
                const issues = Array.isArray(data) ? data : (data.issues || []);
                setResults(issues);
            } catch (err: unknown) {
                const error = err as { message?: string };
                const msg = error.message || "Failed to search Jira.";
                setError(msg.includes('default') ? "No default Jira connection configured." : msg);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query, selectedIssue]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setQuery("");
            setResults([]);
            setError(null);
            setSelectedIssue(null);
            setImporting(false);
        }
    }, [open]);

    const handleSelectIssue = (issue: { id: string; key: string; fields: { summary: string } }) => {
        setSelectedIssue(issue);
        setQuery(issue.key);
        setResults([]);
    };

    const handleClearSelection = () => {
        setSelectedIssue(null);
        setQuery("");
    };

    const handleImport = async () => {
        if (!selectedIssue) return;

        setImporting(true);
        try {
            const connections = await api.getJiraConnections();
            const defaultConn = connections.find(c => c.is_default) || connections[0];

            if (!defaultConn) {
                setError("No Jira connection configured.");
                setImporting(false);
                return;
            }

            await api.saveWorkItem({
                jira_connection_id: defaultConn.id,
                jira_key: selectedIssue.key,
                description: selectedIssue.fields.summary || selectedIssue.key
            });

            onImport();
            onOpenChange(false);
        } catch (err: unknown) {
            const errObj = err as { message?: string };
            // Clean up IPC error message (remove "Error invoking remote method..." prefix)
            const msg = errObj.message || "Failed to import issue.";
            setError(msg);
            setImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Import from Jira</DialogTitle>
                    <DialogDescription>
                        Search for an issue to import as a work item.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="relative">
                        <div className="relative">
                            <Input
                                value={query}
                                onChange={e => {
                                    setQuery(e.target.value);
                                    setSelectedIssue(null);
                                }}
                                placeholder="Search by key or summary (e.g. PROJ-123)"
                                className="pr-8"
                                autoFocus
                            />
                            {loading && (
                                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>

                        {/* Autocomplete dropdown */}
                        {results.length > 0 && !selectedIssue && (
                            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[250px] overflow-y-auto">
                                {results.map(issue => (
                                    <div
                                        key={issue.id}
                                        role="button"
                                        tabIndex={0}
                                        className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-start gap-2 cursor-pointer"
                                        onClick={() => handleSelectIssue(issue)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSelectIssue(issue)}
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

                    {error && <p className="text-destructive text-sm">{error}</p>}

                    {/* Selected issue preview */}
                    {selectedIssue && (
                        <div className="p-3 bg-muted/50 rounded-md border flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-sm font-semibold text-primary">
                                        {selectedIssue.key}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {selectedIssue.fields.summary}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={handleClearSelection}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={!selectedIssue || importing}>
                        {importing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Import
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
