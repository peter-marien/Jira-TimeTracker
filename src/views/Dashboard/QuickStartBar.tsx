import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { useTrackingStore } from "@/stores/useTrackingStore"
import { WorkItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function QuickStartBar() {
    const { startTracking } = useTrackingStore();

    const handleSelect = (item: WorkItem) => {
        startTracking(item);
    };

    return (
        <div className="flex items-center gap-2 w-full max-w-2xl mx-auto p-4">
            <div className="flex-1">
                <WorkItemSearchBar
                    onSelect={handleSelect}
                    placeholder="Search work item to start tracking..."
                    className="h-12 text-lg shadow-sm"
                />
            </div>
            <Button size="icon" variant="outline" className="h-12 w-12 shrink-0">
                <Plus className="h-5 w-5" />
            </Button>
        </div>
    )
}
