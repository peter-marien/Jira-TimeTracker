import { WorkItemSearchBar } from "@/components/shared/WorkItemSearchBar"
import { useTrackingStore } from "@/stores/useTrackingStore"
import { api, WorkItem, JiraConnection } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useState, useEffect } from "react"
import { ImportFromJiraDialog } from "@/components/WorkItem/ImportFromJiraDialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { DailyProgressRing } from "@/components/Dashboard/DailyProgressRing"
import { JiraConnectionChart, ConnectionData } from "@/components/Dashboard/JiraConnectionChart"

interface QuickStartBarProps {
    totalMinutes?: number;
    connectionData?: ConnectionData[];
    targetMinutes?: number;
}

export function QuickStartBar({ totalMinutes = 0, connectionData = [], targetMinutes = 480 }: QuickStartBarProps) {
    const { startTracking, activeTimeSliceId } = useTrackingStore();
    const [importOpen, setImportOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [recentItems, setRecentItems] = useState<WorkItem[]>([]);
    const [connections, setConnections] = useState<JiraConnection[]>([]);

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
        api.getJiraConnections().then(setConnections);
    }, [activeTimeSliceId]);

    const handleSelect = (item: WorkItem) => {
        startTracking(item);
    };

    const handleImportSuccess = () => {
        setRefreshKey(prev => prev + 1);
        fetchRecentItems();
    };

    return (
        <div className="grid grid-cols-[auto_1fr_auto] gap-8 items-start w-full max-w-screen-2xl mx-auto px-4 py-2">
            {/* Left Column: Progress Ring */}
            <div className="hidden lg:flex flex-col items-center justify-start min-w-[300px] gap-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 w-full text-center">Total hours</h3>
                <div className="py-1">
                    <DailyProgressRing totalMinutes={totalMinutes} targetMinutes={targetMinutes} size={88} />
                </div>
            </div>

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
                        {recentItems.map(item => {
                            const connection = item.jira_connection_id ? connections.find(c => c.id === item.jira_connection_id) : null;
                            const badgeColor = connection?.color || (item.jira_key ? 'hsl(var(--primary))' : 'hsl(var(--secondary))');
                            const isHex = badgeColor.startsWith('#');

                            return (
                                <Tooltip key={item.id}>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            key={item.id}
                                            variant="outline"
                                            className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all font-medium py-1 px-3 border-transparent"
                                            style={{
                                                backgroundColor: isHex ? `${badgeColor}20` : (item.jira_key ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--secondary) / 0.1)'),
                                                color: badgeColor
                                            }}
                                            onClick={() => handleSelect(item)}
                                        >
                                            {item.jira_key ? item.jira_key : (
                                                <span className="max-w-[150px] truncate">{item.description}</span>
                                            )}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="p-3">
                                        <div className="space-y-1">
                                            {item.jira_key && <p className="text-[10px] font-black uppercase tracking-tighter" style={{ color: badgeColor }}>{item.jira_key}</p>}
                                            <p className="max-w-[300px] text-xs font-semibold leading-snug">
                                                {item.description}
                                            </p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Right Column: Connection Chart */}
            <div className="hidden lg:flex flex-col items-center justify-start min-w-[300px]">
                <div className="py-1 w-full flex justify-center">
                    <JiraConnectionChart data={connectionData} />
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
