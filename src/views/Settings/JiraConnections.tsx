import { useState, useEffect } from "react"
import { api, JiraConnection } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Edit2, Trash2, MoreHorizontal } from "lucide-react"
import { JiraConnectionDialog } from "@/components/Settings/JiraConnectionDialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Badge } from "@/components/ui/badge"

export function JiraConnections() {
    const [connections, setConnections] = useState<JiraConnection[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingConn, setEditingConn] = useState<JiraConnection | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteConn, setDeleteConn] = useState<JiraConnection | null>(null);

    const fetchConnections = async () => {
        setLoading(true);
        try {
            const data = await api.getJiraConnections();
            setConnections(data);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchConnections();
    }, []);

    const handleAdd = () => {
        setEditingConn(null);
        setIsDialogOpen(true);
    }

    const handleEdit = (conn: JiraConnection) => {
        setEditingConn(conn);
        setIsDialogOpen(true);
    }

    const handleDelete = async () => {
        if (deleteConn) {
            await api.deleteJiraConnection(deleteConn.id);
            setDeleteConn(null);
            fetchConnections();
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Jira Connections</h3>
                <Button size="sm" onClick={handleAdd} variant="outline">
                    <Plus className="h-4 w-4 mr-2" /> Add Connection
                </Button>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <Table>
                    <TableHeader className="bg-secondary/50">
                        <TableRow>
                            <TableHead className="w-[200px]">Name</TableHead>
                            <TableHead>Base URL</TableHead>
                            <TableHead className="w-[150px]">Auth</TableHead>
                            <TableHead className="w-[150px]">Status</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {connections.map(conn => (
                            <TableRow key={conn.id} className="group hover:bg-accent/50 transition-colors">
                                <TableCell className="font-medium whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        {conn.color && (
                                            <div
                                                className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                                                style={{ backgroundColor: conn.color }}
                                            />
                                        )}
                                        {conn.name}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-[300px]" title={conn.base_url}>
                                    {conn.base_url}
                                </TableCell>
                                <TableCell>
                                    {conn.auth_type === 'oauth' ? (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                                            OAuth
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground truncate max-w-[200px]" title={conn.email}>
                                            {conn.email}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {!!conn.is_default && (
                                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                                Default
                                            </Badge>
                                        )}
                                        {conn.is_enabled === 0 && (
                                            <Badge variant="outline" className="text-muted-foreground border-dashed">
                                                Disabled
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(conn)}>
                                                <Edit2 className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setDeleteConn(conn)} className="text-destructive focus:text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {connections.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                    No connections configured. Add one to get started.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <JiraConnectionDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                connection={editingConn}
                onSave={fetchConnections}
            />

            <ConfirmDialog
                open={!!deleteConn}
                onOpenChange={(open) => !open && setDeleteConn(null)}
                onConfirm={handleDelete}
                title="Delete Connection?"
                description={`Are you sure you want to delete "${deleteConn?.name}"? Work items linked to this connection may lose their reference.`} // Warning about linked items would be good logic to have.
                variant="destructive"
                confirmText="Delete"
            />
        </div>
    )
}
