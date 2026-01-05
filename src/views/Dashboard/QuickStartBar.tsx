import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { useTrackingStore } from "@/stores/useTrackingStore"
import { api, WorkItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useState, useEffect } from "react"
import { ImportFromJiraDialog } from "@/components/WorkItem/ImportFromJiraDialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { DailyProgressRing } from "@/components/Dashboard/DailyProgressRing"

interface QuickStartBarProps {
    totalMinutes?: number;
}

export function QuickStartBar({ totalMinutes = 0 }: QuickStartBarProps) {
    const { startTracking, activeTimeSliceId } = useTrackingStore();
    const [importOpen, setImportOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [recentItems, setRecentItems] = useState<WorkItem[]>([]);

    const fetchRecentItems = async () => {
        try {
            const items = await api.getRecentWorkItems();
            setRecentItems(items);
        } catch (err) {
            console.error("Failed to fetch recent items", err);
        }
    };

    useEffect(() => {
        fetchRecentItems();
    }, [activeTimeSliceId]);

    const handleSelect = (item: WorkItem) => {
        startTracking(item);
    };

    const handleImportSuccess = () => {
        setRefreshKey(prev => prev + 1);
        fetchRecentItems();
    };

    return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start w-full px-4 py-2">
            {/* Left Column: Spacer to center the search bar */}
            <div className="hidden lg:block w-full" />

            {/* Center Column: Search Bar & Recent Badges */}
            <div className="flex flex-col gap-3 w-full max-w-5xl min-w-[300px] md:min-w-[600px]">
                <div className="flex items-center gap-2 w-full">
                    <div className="flex-1">
                        <WorkItemSearchBar
                            key={refreshKey}
                            onSelect={handleSelect}
                            placeholder="Search work item to start tracking..."
                            className="h-12 text-lg shadow-sm"
                        />
                    </div>
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
                </div>

                {recentItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/50 w-full mb-1 tracking-widest">Recent Activity</span>
                        {recentItems.map(item => (
                            <Tooltip key={item.id}>
                                <TooltipTrigger asChild>
                                    <Badge
                                        key={item.id}
                                        variant={item.jira_key ? "default" : "secondary"}
                                        className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all font-medium py-1 px-3"
                                        onClick={() => handleSelect(item)}
                                    >
                                        {item.jira_key ? item.jira_key : (
                                            <span className="max-w-[150px] truncate">{item.description}</span>
                                        )}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="p-3">
                                    <div className="space-y-1">
                                        {item.jira_key && <p className="text-[10px] font-black text-primary uppercase tracking-tighter">{item.jira_key}</p>}
                                        <p className="max-w-[300px] text-xs font-semibold leading-snug">
                                            {item.description}
                                        </p>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                )}
            </div>

            {/* Right Column: Centered Progress Ring */}
            <div className="hidden sm:flex items-start justify-center w-full min-w-[120px]">
                <div className="py-1">
                    <DailyProgressRing totalMinutes={totalMinutes} size={88} />
                </div>
            </div>

            <ImportFromJiraDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onImport={handleImportSuccess}
            />
        </div>
    )
}
