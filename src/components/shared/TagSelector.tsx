import { useEffect, useMemo, useState } from "react"
import { Check, ChevronsUpDown, Tag as TagIcon } from "lucide-react"
import { api, Tag } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface TagSelectorProps {
    selectedTagIds: number[];
    onChange: (tagIds: number[]) => void;
}

export function TagSelector({ selectedTagIds, onChange }: TagSelectorProps) {
    const [tags, setTags] = useState<Tag[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        api.getTags().then(setTags).catch(error => console.error("Failed to load tags", error));
    }, [open]);

    const selectedNames = useMemo(() => {
        const selected = new Set(selectedTagIds);
        return tags.filter(tag => selected.has(tag.id)).map(tag => tag.name);
    }, [selectedTagIds, tags]);

    const toggleTag = (tagId: number) => {
        const next = new Set(selectedTagIds);
        if (next.has(tagId)) next.delete(tagId);
        else next.add(tagId);
        onChange(Array.from(next));
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    <span className="flex min-w-0 items-center gap-2">
                        <TagIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                            {selectedNames.length > 0 ? selectedNames.join(", ") : "Select tags..."}
                        </span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-2" align="start">
                {tags.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                        No tags yet. Create them in the Tags module.
                    </p>
                ) : (
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                        {tags.map(tag => {
                            const checked = selectedTagIds.includes(tag.id);
                            return (
                                <div key={tag.id} className="flex w-full items-start gap-3 rounded-md p-2 hover:bg-accent">
                                    <Checkbox
                                        checked={checked}
                                        className="mt-0.5"
                                        aria-label={`Select ${tag.name}`}
                                        onCheckedChange={() => toggleTag(tag.id)}
                                    />
                                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => toggleTag(tag.id)}>
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            {tag.name}
                                            {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                                        </span>
                                        {tag.description && (
                                            <span className="block truncate text-xs text-muted-foreground">{tag.description}</span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
