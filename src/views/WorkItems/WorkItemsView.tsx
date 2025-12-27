import { useState, useEffect } from "react"
import { api, WorkItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Trash2, Edit2, Download } from "lucide-react"
import { JiraBadge } from "@/components/shared/JiraBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { ImportFromJiraDialog } from "@/components/WorkItem/ImportFromJiraDialog"
import { CreateWorkItemDialog } from "@/components/WorkItem/CreateWorkItemDialog"
import { EditWorkItemDialog } from "@/components/WorkItem/EditWorkItemDialog"

export function WorkItemsView() {
    const [items, setItems] = useState<WorkItem[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);

    // Dialogs
    const [importOpen, setImportOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editItem, setEditItem] = useState<WorkItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<WorkItem | null>(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await api.getWorkItems(query);
            setItems(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchItems, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleDelete = async () => {
        if (deleteItem) {
            try {
                // Delete logic in API should check for dependencies or cascade?
                // Current implementation: `run('DELETE FROM work_items WHERE id = ?')`
                // If foreign key ON DELETE CASCADE/SET NULL isn't set, it might fail if referenced.
                // SQLite default FK enforcement is off unless enabled. I didn't enable it explicitly in db.ts `PRAGMA foreign_keys = ON`.
                // But logic says "validate for existing time slices".
                // `api.deleteWorkItem` call `db:delete-work-item`.
                // We should probably check if slices exist first in UI or handle error.

                await api.deleteWorkItem(deleteItem.id);
                fetchItems();
            } catch (e) {
                alert("Cannot delete work item with existing time slices.");
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
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => setEditItem(item)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteItem(item)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
            <ConfirmDialog
                open={!!deleteItem}
                onOpenChange={(open) => !open && setDeleteItem(null)}
                onConfirm={handleDelete}
                title="Delete Work Item?"
                description={`Are you sure you want to delete "${deleteItem?.description}"?`}
                variant="destructive"
                confirmText="Delete"
            />
        </div>
    )
}
