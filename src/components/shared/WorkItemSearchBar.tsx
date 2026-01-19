import { useState, useEffect, useRef } from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, WorkItem, JiraConnection } from "@/lib/api"

interface JiraSearchResult {
    key: string;
    summary: string;
    connectionId: number;
    connectionName: string;
}

type SearchItem =
    | { type: 'local'; item: WorkItem }
    | { type: 'jira'; item: JiraSearchResult };

interface WorkItemSearchBarProps {
    onSelect: (workItem: WorkItem) => void;
    className?: string;
    placeholder?: string;
    autoFocus?: boolean;
}

// Simple Jira icon component
function JiraIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.213 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1-1.001zM23 0H11.455a5.215 5.215 0 0 0 5.212 5.214h2.129v2.057A5.215 5.215 0 0 0 24 12.485V1a1 1 0 0 0-1-1z" />
        </svg>
    );
}

export function WorkItemSearchBar({ onSelect, className, placeholder = "Search work items...", autoFocus = false }: WorkItemSearchBarProps) {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState("")
    const [query, setQuery] = useState("")
    const [localItems, setLocalItems] = useState<WorkItem[]>([])
    const [jiraItems, setJiraItems] = useState<JiraSearchResult[]>([])
    const [localLoading, setLocalLoading] = useState(false)
    const [jiraLoading, setJiraLoading] = useState(false)
    const [connections, setConnections] = useState<JiraConnection[]>([]);
    const initialFocusDone = useRef(false)

    useEffect(() => {
        api.getJiraConnections().then(setConnections);
    }, []);

    // Auto-open the popover when autoFocus is true
    useEffect(() => {
        if (autoFocus && !initialFocusDone.current) {
            // Small delay to ensure the component is fully mounted
            const timer = setTimeout(() => {
                setOpen(true);
                initialFocusDone.current = true;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [autoFocus]);

    // Local search
    useEffect(() => {
        const timer = setTimeout(() => {
            setLocalLoading(true);
            api.getWorkItems({ query }).then(res => {
                setLocalItems(res || []);
            }).finally(() => setLocalLoading(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Jira search (all connections)
    useEffect(() => {
        if (!query.trim()) {
            setJiraItems([]);
            return;
        }

        const timer = setTimeout(() => {
            setJiraLoading(true);
            api.searchJiraIssuesAllConnections(query).then(res => {
                setJiraItems(res.results || []);
                if (res.errors && res.errors.length > 0) {
                    console.error("Jira search errors:", res.errors);
                }
            }).catch(err => {
                console.error("Jira search failed:", err);
                setJiraItems([]);
            }).finally(() => setJiraLoading(false));
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    // Get set of imported Jira keys for deduplication
    const importedKeys = new Set(localItems.filter(i => i.jira_key).map(i => i.jira_key));

    // Combine and sort results: local items first, then Jira items (excluding duplicates)
    const combinedItems: SearchItem[] = [
        ...localItems.map(item => ({ type: 'local' as const, item })),
        ...jiraItems
            .filter(j => !importedKeys.has(j.key))
            .map(item => ({ type: 'jira' as const, item }))
    ];

    const handleSelectLocal = (item: WorkItem) => {
        setValue(item.description);
        onSelect(item);
        setOpen(false);
    };

    const handleSelectJira = async (jiraItem: JiraSearchResult) => {
        try {
            const newWorkItem = await api.saveWorkItem({
                jira_connection_id: jiraItem.connectionId,
                jira_key: jiraItem.key,
                description: jiraItem.summary,
            });
            setValue(newWorkItem.description);
            onSelect(newWorkItem);
            setOpen(false);
        } catch (err) {
            console.error("Failed to import Jira issue:", err);
        }
    };

    const isLoading = localLoading || jiraLoading;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between min-w-0", className)}
                >
                    <span className="truncate flex-1 text-left">
                        {value
                            ? (localItems.find((item) => item.description === value)?.description || value)
                            : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false} className="h-auto">
                    <CommandInput placeholder="Search work items (key or description)..." value={query} onValueChange={setQuery} />
                    <CommandList onWheel={(e) => e.stopPropagation()}>
                        <CommandEmpty>
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Searching...
                                </span>
                            ) : "No work item found."}
                        </CommandEmpty>

                        {combinedItems.length > 0 && (
                            <CommandGroup heading={
                                <span className="flex items-center gap-2">
                                    Results
                                    {jiraLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                </span>
                            }>
                                {combinedItems.map((searchItem) => {
                                    if (searchItem.type === 'local') {
                                        const item = searchItem.item;
                                        return (
                                            <CommandItem
                                                key={`local-${item.id}`}
                                                value={item.description}
                                                onSelect={() => handleSelectLocal(item)}
                                                className="flex flex-col items-start gap-1 py-3"
                                            >
                                                <span className="font-bold truncate w-full">{item.description}</span>
                                                {item.jira_key && (
                                                    <span
                                                        className="text-xs font-mono"
                                                        style={{ color: connections.find(c => c.id === item.jira_connection_id)?.color || 'hsl(var(--primary))' }}
                                                    >
                                                        {item.jira_key}
                                                    </span>
                                                )}
                                            </CommandItem>
                                        );
                                    } else {
                                        const jiraItem = searchItem.item;
                                        return (
                                            <CommandItem
                                                key={`jira-${jiraItem.connectionId}-${jiraItem.key}`}
                                                value={`${jiraItem.key} ${jiraItem.summary}`}
                                                onSelect={() => handleSelectJira(jiraItem)}
                                                className="flex items-center justify-between py-3"
                                            >
                                                <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
                                                    <span className="font-bold truncate w-full">{jiraItem.summary}</span>
                                                    <span
                                                        className="text-xs font-mono"
                                                        style={{ color: connections.find(c => c.id === jiraItem.connectionId)?.color || 'hsl(var(--primary))' }}
                                                    >
                                                        {jiraItem.key}
                                                    </span>
                                                </div>
                                                <JiraIcon className="h-4 w-4 text-blue-500 shrink-0 ml-2" />
                                            </CommandItem>
                                        );
                                    }
                                })}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
