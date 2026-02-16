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
    const [results, setResults] = useState<{ key: string; summary: string; connectionId: number; connectionName: string }[]>([]);
    const [connectionErrors, setConnectionErrors] = useState<{ connectionId: number; connectionName: string; error: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIssue, setSelectedIssue] = useState<{ key: string; summary: string; connectionId: number; connectionName: string } | null>(null);
    const [importing, setImporting] = useState(false);
    const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());

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
                const response = await api.searchJiraIssuesAllConnections(query);
                setResults(response.results);
                setConnectionErrors(response.errors);
            } catch (err: unknown) {
                const error = err as { message?: string };
                setError(error.message || "Failed to search Jira.");
                setResults([]);
                setConnectionErrors([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query, selectedIssue]);

    // Load imported keys
    useEffect(() => {
        if (open) {
            api.getWorkItems({ showCompleted: true }).then(items => {
                const keys = new Set(items.filter(i => i.jira_key).map(i => i.jira_key!));
                setImportedKeys(keys);
            });
        }
    }, [open]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setQuery("");
            setResults([]);
            setConnectionErrors([]);
            setError(null);
            setSelectedIssue(null);
            setImporting(false);
        }
    }, [open]);

    const handleSelectIssue = (issue: { key: string; summary: string; connectionId: number; connectionName: string }) => {
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
            await api.saveWorkItem({
                jira_connection_id: selectedIssue.connectionId,
                jira_key: selectedIssue.key,
                description: selectedIssue.summary || selectedIssue.key
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
                        {(results.length > 0 || connectionErrors.length > 0) && !selectedIssue && (
                            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[300px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                {connectionErrors.map((err) => (
                                    <div key={`err-${err.connectionId}`} className="px-3 py-2 border-b bg-destructive/10 text-destructive text-sm flex flex-col">
                                        <span className="font-semibold text-xs">{err.connectionName}</span>
                                        <span>{err.error}</span>
                                    </div>
                                ))}
                                {results.map((issue) => (
                                    <div
                                        key={`${issue.connectionId}-${issue.key}`}
                                        role="button"
                                        tabIndex={0}
                                        className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-start gap-2 cursor-pointer border-b last:border-0"
                                        onClick={() => handleSelectIssue(issue)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSelectIssue(issue)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-mono text-[10px] font-semibold bg-secondary px-1.5 py-0.5 rounded shrink-0">
                                                {issue.key}
                                            </span>
                                            {importedKeys.has(issue.key) && (
                                                <span className="text-[10px] text-primary font-bold mt-1">
                                                    Imported
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-sm line-clamp-1">{issue.summary}</span>
                                            <span className="text-[10px] text-muted-foreground">{issue.connectionName}</span>
                                        </div>
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
                                    <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">
                                        {selectedIssue.connectionName}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {selectedIssue.summary}
                                </p>
                                {importedKeys.has(selectedIssue.key) && (
                                    <p className="text-xs text-primary font-semibold mt-2">
                                        This item is already imported.
                                    </p>
                                )}
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
                    <Button onClick={handleImport} disabled={!selectedIssue || importing || importedKeys.has(selectedIssue.key)}>
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
