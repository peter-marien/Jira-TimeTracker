import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { api } from "@/lib/api"
import { Search, Loader2, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ImportFromJiraDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: () => void;
}

export function ImportFromJiraDialog({ open, onOpenChange, onImport }: ImportFromJiraDialogProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        try {
            // Logic: call api.searchJiraIssues
            // Note: API may return issues array directly or { issues: [...] }
            const data = await api.searchJiraIssues(query);
            // Handle both array and object response formats
            const issues = Array.isArray(data) ? data : (data.issues || []);
            setResults(issues);
        } catch (err: any) {
            console.error(err);
            // Err.message might be "No default Jira connection found"
            const msg = err.message || "Failed to search Jira. Check your connection settings.";
            setError(msg.includes('default') ? "No default Jira connection found. Please set one in Settings." : msg);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (issue: any) => {
        // Create work item from issue
        try {
            // Check if default connection exists? IPC handles it.
            // Get default connection ID? 
            // We need connection ID to link. 
            // The IPC Handler uses default connection but doesn't return ID directly unless we ask.
            // Ideally 'search-issues' should assume default context or we pass it.

            // For MVP, we fetch connections, find default, use that ID.
            const connections = await api.getJiraConnections();
            const defaultConn = connections.find(c => c.is_default) || connections[0];

            if (!defaultConn) {
                setError("No Jira connection configured.");
                return;
            }

            // Check if already exists?
            // We can just create.

            await api.saveWorkItem({
                jira_connection_id: defaultConn.id,
                jira_key: issue.key,
                description: issue.fields.summary || issue.key
            });

            onImport();
            onOpenChange(false);
        } catch (err) {
            setError("Failed to import issue.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import from Jira</DialogTitle>
                    <DialogDescription>
                        Search for issues by key or summary to import as work items.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-2 py-4">
                    <Input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search (e.g. PROJ-123 or 'feature')"
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>

                {error && <div className="text-destructive text-sm px-1">{error}</div>}

                <ScrollArea className="flex-1 border rounded-md p-2">
                    {results.length === 0 && !loading && (
                        <div className="text-center text-muted-foreground py-10">
                            {query ? "No issues found." : "Enter a query to search."}
                        </div>
                    )}

                    <div className="space-y-2">
                        {results.map(issue => (
                            <div key={issue.id} className="flex items-start justify-between p-3 border rounded hover:bg-accent/50 group">
                                <div className="min-w-0 mr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs font-semibold bg-secondary px-1.5 py-0.5 rounded">{issue.key}</span>
                                    </div>
                                    <p className="text-sm font-medium line-clamp-2">{issue.fields.summary}</p>
                                </div>
                                <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleImport(issue)}>
                                    <Plus className="h-4 w-4 mr-1" /> Import
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
