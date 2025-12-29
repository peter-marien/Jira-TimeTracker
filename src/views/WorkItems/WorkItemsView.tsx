import { useState, useEffect } from "react"
import { api, WorkItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Trash2, Edit2, Download, MoreHorizontal, History } from "lucide-react"
import { JiraBadge } from "@/components/shared/JiraBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { ImportFromJiraDialog } from "@/components/WorkItem/ImportFromJiraDialog"
import { CreateWorkItemDialog } from "@/components/WorkItem/CreateWorkItemDialog"
import { EditWorkItemDialog } from "@/components/WorkItem/EditWorkItemDialog"
import { WorkItemTimeSlicesDialog } from "@/components/WorkItem/WorkItemTimeSlicesDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MessageDialog } from "@/components/shared/MessageDialog"

export function WorkItemsView() {
    const [items, setItems] = useState<WorkItem[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 50;

    // Dialogs
    const [importOpen, setImportOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editItem, setEditItem] = useState<WorkItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<WorkItem | null>(null);
    const [timeSlicesItem, setTimeSlicesItem] = useState<WorkItem | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const offset = (currentPage - 1) * itemsPerPage;
            const [data, count] = await Promise.all([
                api.getWorkItems({ query, limit: itemsPerPage, offset }),
                api.getWorkItemsCount({ query })
            ]);
            setItems(data);
            setTotalCount(count);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1); // Reset to page 1 on search
    }, [query]);

    useEffect(() => {
        const timer = setTimeout(fetchItems, 300);
        return () => clearTimeout(timer);
    }, [query, currentPage]);

    const handleDelete = async () => {
        if (deleteItem) {
            try {
                await api.deleteWorkItem(deleteItem.id);
                fetchItems();
            } catch (e) {
                setError("Cannot delete work item with existing time slices.");
            }
            setDeleteItem(null);
        }
    }

    return (
        <div className="flex flex-col h-full bg-background p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Work Items</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setImportOpen(true)}>
                        <Download className="mr-2 h-4 w-4" /> Import from Jira
                    </Button>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> New Work Item
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    className="max-w-sm"
                    placeholder="Search work items..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>

            <div className="border rounded-md flex-1 overflow-hidden">
                <div className="overflow-y-auto h-full">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">Jira Key</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[150px]">Connection</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No work items found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {items.map(item => (
                                <TableRow
                                    key={item.id}
                                    className="cursor-default select-none"
                                    onDoubleClick={() => setEditItem(item)}
                                >
                                    <TableCell>
                                        {item.jira_key ? <JiraBadge jiraKey={item.jira_key} /> : <span className="text-muted-foreground text-xs italic">Manual</span>}
                                    </TableCell>
                                    <TableCell className="font-medium">{item.description}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {item.connection_name || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditItem(item)}>
                                                    <Edit2 className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setTimeSlicesItem(item)}>
                                                    <History className="mr-2 h-4 w-4" />
                                                    Show Time Slices
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteItem(item)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                    Showing {totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                    {Math.min(totalCount, currentPage * itemsPerPage)} of {totalCount} items
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || loading}
                    >
                        Previous
                    </Button>
                    <div className="text-sm font-medium w-20 text-center">
                        Page {currentPage}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage * itemsPerPage >= totalCount || loading}
                    >
                        Next
                    </Button>
                </div>
            </div>

            <ImportFromJiraDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onImport={fetchItems}
            />
            <CreateWorkItemDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSave={fetchItems}
            />
            <EditWorkItemDialog
                open={!!editItem}
                onOpenChange={(open) => !open && setEditItem(null)}
                item={editItem}
                onSave={fetchItems}
            />
            <WorkItemTimeSlicesDialog
                open={!!timeSlicesItem}
                onOpenChange={(open) => !open && setTimeSlicesItem(null)}
                workItem={timeSlicesItem}
            />
            <ConfirmDialog
                open={!!deleteItem}
                onOpenChange={(open) => !open && setDeleteItem(null)}
                onConfirm={handleDelete}
                title="Delete Work Item?"
                description={`Are you sure you want to delete "${deleteItem?.description}"?`}
                confirmText="Delete"
                variant="destructive"
            />
            <MessageDialog
                open={!!error}
                onOpenChange={(open) => !open && setError(null)}
                title="Cannot Delete"
                description={error || ""}
            />
        </div>
    )
}
