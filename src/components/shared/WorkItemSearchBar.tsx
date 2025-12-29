import { useState, useEffect } from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, WorkItem } from "@/lib/api"
import { JiraBadge } from "./JiraBadge"

interface WorkItemSearchBarProps {
    onSelect: (workItem: WorkItem) => void;
    className?: string;
    placeholder?: string;
}

export function WorkItemSearchBar({ onSelect, className, placeholder = "Search work items..." }: WorkItemSearchBarProps) {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState("")
    const [query, setQuery] = useState("")
    const [items, setItems] = useState<WorkItem[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            setLoading(true);
            api.getWorkItems(query).then(res => {
                setItems(res || []);
            }).finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", className)}
                >
                    {value
                        ? (items.find((item) => item.description === value)?.description || value)
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search work items (key or description)..." value={query} onValueChange={setQuery} />
                    <CommandList>
                        <CommandEmpty>{loading ? "Searching..." : "No work item found."}</CommandEmpty>
                        <CommandGroup heading="Recent Work Items">
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={item.description}
                                    onSelect={(currentValue) => {
                                        setValue(currentValue)
                                        onSelect(item)
                                        setOpen(false)
                                    }}
                                    className="flex flex-col items-start gap-1 py-3"
                                >
                                    <div className="flex items-center w-full gap-2">
                                        <span className="font-medium truncate">{item.description}</span>
                                    </div>
                                    {item.jira_key && <JiraBadge jiraKey={item.jira_key} />}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
