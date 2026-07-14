import { useEffect, useState } from "react"
import { Pencil, Plus, Save, Tag as TagIcon, Trash2, X } from "lucide-react"
import { api, Tag } from "@/lib/api"
import { validateTagName } from "@/lib/tags"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface TagDraft {
    id?: number;
    name: string;
    description: string;
}

const emptyDraft: TagDraft = { name: "", description: "" };

export function TagsView() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [draft, setDraft] = useState<TagDraft>(emptyDraft);
    const [error, setError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

    const loadTags = async () => setTags(await api.getTags());

    useEffect(() => {
        loadTags().catch(error => setError(error instanceof Error ? error.message : "Failed to load tags."));
    }, []);

    const saveTag = async () => {
        const validationError = validateTagName(draft.name);
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            await api.saveTag(draft);
            setDraft(emptyDraft);
            setError(null);
            await loadTags();
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to save tag.");
        }
    };

    const deleteTag = async () => {
        if (!deleteTarget) return;
        try {
            await api.deleteTag(deleteTarget.id);
            if (draft.id === deleteTarget.id) setDraft(emptyDraft);
            setDeleteTarget(null);
            setError(null);
            await loadTags();
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to delete tag.");
        }
    };

    return (
        <div className="flex flex-1 flex-col space-y-6 overflow-y-auto bg-background p-6" onWheel={event => event.stopPropagation()}>
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
                <p className="mt-1 text-sm text-muted-foreground">Manage tags that can be linked to time slices and synced to Jira.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <Card>
                    <CardHeader>
                        <CardTitle>Tags</CardTitle>
                        <CardDescription>Create, review, and organize your available tags.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {tags.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                                <TagIcon className="h-8 w-8" />
                                <p className="text-sm">No tags have been created yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y rounded-md border">
                                {tags.map(tag => (
                                    <div key={tag.id} className="flex items-start gap-4 p-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium">{tag.name}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {tag.description || "No description"}
                                            </p>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${tag.name}`} onClick={() => {
                                            setDraft({ id: tag.id, name: tag.name, description: tag.description });
                                            setError(null);
                                        }}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${tag.name}`} onClick={() => setDeleteTarget(tag)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle>{draft.id ? "Edit Tag" : "New Tag"}</CardTitle>
                        <CardDescription>Jira renders this tag as #[[name]].</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="tag-name">Name</Label>
                            <Input id="tag-name" value={draft.name} maxLength={100} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="tag-description">Description</Label>
                            <Textarea id="tag-description" value={draft.description} rows={4} maxLength={500} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} />
                        </div>
                        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                        <div className="flex gap-2">
                            <Button type="button" onClick={saveTag}>
                                {draft.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                {draft.id ? "Save Changes" : "Add Tag"}
                            </Button>
                            {draft.id && (
                                <Button type="button" variant="outline" onClick={() => { setDraft(emptyDraft); setError(null); }}>
                                    <X className="mr-2 h-4 w-4" /> Cancel
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete tag?</AlertDialogTitle>
                        <AlertDialogDescription>
                            “{deleteTarget?.name}” will be unlinked from every time slice. Previously synced slices will be marked for Jira resync.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteTag}>Delete Tag</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
