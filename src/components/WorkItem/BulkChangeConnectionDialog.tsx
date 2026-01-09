import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
import { Loader2 } from "lucide-react"

interface BulkChangeConnectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (connectionId: number | null) => Promise<void>;
    selectedCount: number;
}

export function BulkChangeConnectionDialog({ open, onOpenChange, onSave, selectedCount }: BulkChangeConnectionDialogProps) {
    const [connections, setConnections] = useState<JiraConnection[]>([]);
    const [connectionId, setConnectionId] = useState<string>("none");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            api.getJiraConnections().then(setConnections);
            setConnectionId("none");
        }
    }, [open]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(connectionId === "none" ? null : Number(connectionId));
            onOpenChange(false);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Change Jira Connection</DialogTitle>
                    <DialogDescription>
                        Set a new Jira connection for the {selectedCount} selected work items.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="bulk-connection">Jira Connection</Label>
                        <Select value={connectionId} onValueChange={setConnectionId}>
                            <SelectTrigger id="bulk-connection">
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
                                            {conn.is_enabled === 0 && (
                                                <span className="text-[10px] text-muted-foreground ml-1">(Disabled)</span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update {selectedCount} Items
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    )
}
