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
import { useState } from "react"
import { api } from "@/lib/api"

interface CreateWorkItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function CreateWorkItemDialog({ open, onOpenChange, onSave }: CreateWorkItemDialogProps) {
    const [description, setDescription] = useState("");

    const handleSave = async () => {
        if (!description.trim()) return;

        await api.saveWorkItem({
            description: description,
            // No jira connection/key for manual items
            jira_connection_id: null,
            jira_key: null
        });

        setDescription(""); // Reset
        onSave();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Manual Work Item</DialogTitle>
                    <DialogDescription>
                        Create a local work item not linked to Jira.
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
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleSave}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
