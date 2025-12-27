import { useState, useEffect } from "react"
import { api, JiraConnection } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Edit2, Trash2 } from "lucide-react"
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {connections.map(conn => (
                    <Card key={conn.id} className="relative group hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-semibold truncate pr-6">{conn.name}</CardTitle>
                                {!!conn.is_default && (
                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 absolute top-4 right-4">
                                        Default
                                    </Badge>
                                )}
                            </div>
                            <CardDescription className="truncate">{conn.base_url}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground truncate mb-4">{conn.email}</div>
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(conn)}>
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteConn(conn)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {connections.length === 0 && !loading && (
                    <div className="col-span-full text-center py-8 text-muted-foreground bg-muted/20 rounded-md border border-dashed">
                        No connections configured. Add one to get started.
                    </div>
                )}
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
