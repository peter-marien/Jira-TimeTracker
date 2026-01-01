import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { useTrackingStore } from "@/stores/useTrackingStore"
import { WorkItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useState } from "react"
import { ImportFromJiraDialog } from "@/components/WorkItem/ImportFromJiraDialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { DailyProgressRing } from "@/components/Dashboard/DailyProgressRing"

interface QuickStartBarProps {
    totalMinutes?: number;
}

export function QuickStartBar({ totalMinutes = 0 }: QuickStartBarProps) {
    const { startTracking } = useTrackingStore();
    const [importOpen, setImportOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleSelect = (item: WorkItem) => {
        startTracking(item);
    };

    const handleImportSuccess = () => {
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 w-full p-4">
            {/* Left Spacer to balance grid */}
            <div className="hidden lg:block" />

            {/* Center: Search Bar */}
            <div className="flex items-center gap-2 w-full max-w-2xl">
                <div className="flex-1">
                    <WorkItemSearchBar
                        key={refreshKey}
                        onSelect={handleSelect}
                        placeholder="Search work item to start tracking..."
                        className="h-12 text-lg shadow-sm"
                    />
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon"
                                variant="outline"
                                className="h-12 w-12 shrink-0"
                                onClick={() => setImportOpen(true)}
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Import from Jira</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Right: Progress Ring */}
            <div className="flex justify-center hidden lg:flex">
                <DailyProgressRing totalMinutes={totalMinutes} size={80} />
            </div>

            <ImportFromJiraDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onImport={handleImportSuccess}
            />
        </div>
    )
}
