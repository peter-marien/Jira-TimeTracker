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
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useState, useEffect } from "react"
import { api, WorkItem, JiraConnection } from "@/lib/api"

interface EditWorkItemDialogProps {
    item: WorkItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function EditWorkItemDialog({ item, open, onOpenChange, onSave }: EditWorkItemDialogProps) {
    const [description, setDescription] = useState("");
    const [jiraKey, setJiraKey] = useState("");
    const [connections, setConnections] = useState<JiraConnection[]>([]);
    const [connectionId, setConnectionId] = useState<string>("none");

    useEffect(() => {
        api.getJiraConnections().then(setConnections);
    }, []);

    useEffect(() => {
        if (item && open) {
            setDescription(item.description);
            setJiraKey(item.jira_key || "");
            setConnectionId(item.jira_connection_id ? item.jira_connection_id.toString() : "none");
        }
    }, [item, open]);

    const handleSave = async () => {
        if (!item || !description.trim()) return;

        await api.saveWorkItem({
            id: item.id,
            description: description,
            jira_key: jiraKey || null,
            jira_connection_id: connectionId === "none" ? null : Number(connectionId)
        });

        onSave();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Work Item</DialogTitle>
                    <DialogDescription>
                        Update work item details.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-desc">Description</Label>
                        <Input
                            id="edit-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-connection">Jira Connection</Label>
                        <Select value={connectionId} onValueChange={setConnectionId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select connection" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {connections.map(conn => (
                                    <SelectItem key={conn.id} value={conn.id.toString()}>
                                        {conn.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-key">Jira Key (Optional)</Label>
                        <Input
                            id="edit-key"
                            value={jiraKey}
                            onChange={(e) => setJiraKey(e.target.value)}
                            placeholder="PROJ-123"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    )
}
