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
import { api, JiraConnection } from "@/lib/api"

interface CreateWorkItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function CreateWorkItemDialog({ open, onOpenChange, onSave }: CreateWorkItemDialogProps) {
    const [description, setDescription] = useState("");
    const [connections, setConnections] = useState<JiraConnection[]>([]);
    const [connectionId, setConnectionId] = useState<string>("none");
    const [jiraKey, setJiraKey] = useState("");

    useEffect(() => {
        if (open) {
            api.getJiraConnections().then(setConnections);
            // Reset fields
            setDescription("");
            setConnectionId("none");
            setJiraKey("");
        }
    }, [open]);

    const handleSave = async () => {
        if (!description.trim()) return;

        await api.saveWorkItem({
            description: description,
            jira_connection_id: connectionId === "none" ? null : Number(connectionId),
            jira_key: jiraKey.trim() || null
        });

        setDescription("");
        onSave();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Manual Work Item</DialogTitle>
                    <DialogDescription>
                        Create a local work item. You can optionally link it to Jira.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Internal Meeting"
                            autoFocus
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="connection">Jira Connection (Optional)</Label>
                        <Select value={connectionId} onValueChange={setConnectionId}>
                            <SelectTrigger id="connection">
                                <SelectValue placeholder="Select connection" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None (Manual)</SelectItem>
                                {connections.map(conn => (
                                    <SelectItem key={conn.id} value={conn.id.toString()}>
                                        <div className="flex items-center gap-2">
                                            {conn.color && (
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                                                    style={{ backgroundColor: conn.color }}
                                                />
                                            )}
                                            {conn.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="jiraKey">Jira Key (Optional)</Label>
                        <Input
                            id="jiraKey"
                            value={jiraKey}
                            onChange={(e) => setJiraKey(e.target.value)}
                            placeholder="e.g. PROJ-123"
                            disabled={connectionId === "none"}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleSave}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
