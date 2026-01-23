import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useDateStore } from "@/stores/useDateStore"
import { api, WorkItem, TimeSlice, JiraConnection } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
    format,
    formatISO,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isWeekend,
    getDate,
    differenceInSeconds,
    addMonths,
    subMonths
} from "date-fns"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthCellDialog } from "@/components/MonthView/MonthCellDialog"
import { MonthlyHoursChart } from "@/components/MonthView/MonthlyHoursChart"
import { ProjectHoursChart } from "@/components/MonthView/ProjectHoursChart"
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TimeSliceTooltipContent } from "@/components/shared/TimeSliceTooltip"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ExternalLink, Info } from "lucide-react"

export function MonthView() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [slices, setSlices] = useState<TimeSlice[]>([]);
    const [connections, setConnections] = useState<JiraConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [manualColor, setManualColor] = useState("#64748b");

    // Dialog state
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
    const [selectedDateLabel, setSelectedDateLabel] = useState("");
    const [selectedHours, setSelectedHours] = useState("");
    const [selectedNotes, setSelectedNotes] = useState("");

    const navigate = useNavigate();
    const setSelectedDate = useDateStore(state => state.setSelectedDate);

    const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
    const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const startStr = formatISO(monthStart);
                const endStr = formatISO(monthEnd);

                const fetchedSlices = await api.getTimeSlices(startStr, endStr);
                setSlices(fetchedSlices);
            } catch (err) {
                console.error("Failed to fetch month data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentMonth, monthStart, monthEnd]);

    useEffect(() => {
        api.getJiraConnections().then(setConnections);
        api.getSettings().then(settings => {
            if (settings.other_color) {
                setManualColor(settings.other_color);
            }
        });
    }, []);

    // Derive work items from slices
    const activeWorkItems = useMemo(() => {
        const itemMap = new Map<number, WorkItem>();

        slices.forEach(slice => {
            if (!itemMap.has(slice.work_item_id)) {
                itemMap.set(slice.work_item_id, {
                    id: slice.work_item_id,
                    description: slice.work_item_description || "Unknown Work Item",
                    jira_key: slice.jira_key,
                    connection_name: slice.connection_name
                } as WorkItem);
            }
        });

        return Array.from(itemMap.values()).sort((a, b) =>
            (a.jira_key || "").localeCompare(b.jira_key || "") ||
            a.description.localeCompare(b.description)
        );
    }, [slices]);

    // Data aggregation
    // Map: workItemId -> dayOfMonth -> seconds
    const aggregation = useMemo(() => {
        const data: Record<number, Record<number, number>> = {};

        slices.forEach(slice => {
            const start = new Date(slice.start_time);
            const end = slice.end_time ? new Date(slice.end_time) : new Date(); // If active, use current time

            // Only count time within the selected month (though query should have handled it)
            // But slices can span days or month boundaries. For simplicity, we use the start_time's day.
            const day = getDate(start);
            const seconds = end ? differenceInSeconds(end, start) : 0;

            if (!data[slice.work_item_id]) data[slice.work_item_id] = {};
            data[slice.work_item_id][day] = (data[slice.work_item_id][day] || 0) + seconds;
        });

        return data;
    }, [slices]);

    // Fast lookup for slices: "workItemId-day" -> TimeSlice[]
    const dailySliceMap = useMemo(() => {
        const map = new Map<string, TimeSlice[]>();
        slices.forEach(s => {
            const start = new Date(s.start_time);
            const d = getDate(start);
            const key = `${s.work_item_id}-${d}`;

            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(s);
        });

        // Sort each entry once
        map.forEach(list => {
            list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        });

        return map;
    }, [slices]);

    const getDaySlices = (itemId: number, day: number) => {
        return dailySliceMap.get(`${itemId}-${day}`) || [];
    };

    // Group work items by connection name
    const itemsByConnection = useMemo(() => {
        const grouped: Record<string, WorkItem[]> = {};
        activeWorkItems.forEach(item => {
            const connName = item.connection_name || "Manual / No Connection";
            if (!grouped[connName]) grouped[connName] = [];
            grouped[connName].push(item);
        });
        return grouped;
    }, [activeWorkItems]);

    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const formatHours = (seconds: number) => {
        if (!seconds) return "";
        const hours = seconds / 3600;
        // Format to 2 decimal places, but remove trailing zeros
        return parseFloat(hours.toFixed(2)).toString().replace(".", ",");
    };

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Monthly stats calculations
    const stats = useMemo(() => {
        const workingDays = daysInMonth.filter(d => !isWeekend(d)).length;

        // Total hours calculation
        const totalSeconds = slices.reduce((acc, s) => {
            const start = new Date(s.start_time);
            const end = s.end_time ? new Date(s.end_time) : new Date();
            return acc + differenceInSeconds(end, start);
        }, 0);
        const totalHours = totalSeconds / 3600;

        // Calculate workdays until the last day with logged time
        let avgHours = 0;
        let workdaysUntilLastLog = 0;

        if (slices.length > 0) {
            const lastLoggedTime = Math.max(...slices.map(s => new Date(s.start_time).getTime()));
            const lastLoggedDate = new Date(lastLoggedTime);

            // Set to start of day for accurate comparison if needed, 
            // but since daysInMonth are start-of-day, simple <= works
            workdaysUntilLastLog = daysInMonth.filter(d =>
                !isWeekend(d) && d <= lastLoggedDate
            ).length;

            if (workdaysUntilLastLog > 0) {
                avgHours = totalHours / workdaysUntilLastLog;
            }
        }

        const overtime = totalHours - (workingDays * 8);

        return {
            workingDays,
            totalHours,
            avgHours,
            overtime,
            workdaysUntilLastLog
        };
    }, [daysInMonth, slices]);

    const formatDecimal = (val: number) => {
        return parseFloat(val.toFixed(2)).toString().replace(".", ",");
    };

    const handleCellClick = (item: WorkItem, day: Date, seconds: number) => {
        if (seconds <= 0) return;

        const d = getDate(day);
        const daySlices = getDaySlices(item.id, d); // Use the optimize lookup here too

        const uniqueNotes = Array.from(new Set(
            daySlices
                .map(s => s.notes?.trim())
                .filter(Boolean)
        ));

        const notes = uniqueNotes.join("\n");

        setSelectedItem(item);
        setSelectedDateLabel(format(day, "EEEE, MMMM do, yyyy"));
        setSelectedHours(formatHours(seconds));
        setSelectedNotes(notes);
        setIsDetailsOpen(true);
    };

    const handleGoToDashboard = (day: Date) => {
        setSelectedDate(day);
        navigate("/");
    };

    return (
        <TooltipProvider>
            <div className="flex flex-col h-full bg-background overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Month View</h1>
                        <div className="flex gap-6 mt-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total working days</span>
                                <span className="text-lg font-semibold">{stats.workingDays}</span>
                            </div>
                            <div className="flex flex-col border-l pl-6">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Average hours/workday</span>
                                <span className="text-lg font-semibold">{formatDecimal(stats.avgHours)}h</span>
                            </div>
                            <div className="flex flex-col border-l pl-6">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Overtime</span>
                                <span className={cn("text-lg font-semibold", stats.overtime > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                                    {stats.overtime > 0 ? "+" : ""}{formatDecimal(stats.overtime)}h
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={prevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-lg font-semibold min-w-[150px] text-center">
                                {format(currentMonth, "MMMM yyyy")}
                            </span>
                            <Button variant="outline" size="icon" onClick={nextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="w-fit mb-2">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="by-connection">By Connection</TabsTrigger>
                        <TabsTrigger value="chart">Daily Chart</TabsTrigger>
                        <TabsTrigger value="project-hours">Project Hours</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="flex-1 min-h-0 mt-0">
                        <div className="h-full border rounded-md overflow-auto bg-card shadow-sm" onWheel={(e) => e.stopPropagation()}>
                            <table className="w-full border-collapse text-xs table-fixed">
                                <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-20 shadow-sm">
                                    <tr>
                                        <th className="w-24 p-2 border-r border-b text-left bg-primary/10 font-bold">Jira Key</th>
                                        <th className="w-64 p-2 border-r border-b text-left bg-primary/10 font-bold">Work Item</th>
                                        {daysInMonth.map(day => (
                                            <th
                                                key={day.toISOString()}
                                                className={cn(
                                                    "w-8 border-r border-b text-center font-medium",
                                                    isWeekend(day) ? "bg-muted/60 text-muted-foreground" : "bg-primary/5"
                                                )}
                                            >
                                                {getDate(day)}
                                            </th>
                                        ))}
                                        <th className="w-16 p-2 border-b text-center bg-primary/10 font-bold">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeWorkItems.map(item => {
                                        let itemTotal = 0;
                                        return (
                                            <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                                                <td className="p-2 border-r border-b font-mono text-[10px] truncate">{item.jira_key || "-"}</td>
                                                <td className="p-2 border-r border-b truncate" title={item.description}>{item.description}</td>
                                                {daysInMonth.map(day => {
                                                    const d = getDate(day);
                                                    const seconds = aggregation[item.id]?.[d] || 0;
                                                    itemTotal += seconds;

                                                    // OPTIMIZATION: Conditional rendering
                                                    if (seconds <= 0) {
                                                        return (
                                                            <td
                                                                key={day.toISOString()}
                                                                className={cn(
                                                                    "border-r border-b text-center p-0 h-8",
                                                                    isWeekend(day) && "bg-muted/40"
                                                                )}
                                                            />
                                                        );
                                                    }

                                                    // Use fast lookup
                                                    const daySlices = getDaySlices(item.id, d);

                                                    return (
                                                        <Tooltip key={day.toISOString()}>
                                                            <ContextMenu>
                                                                <ContextMenuTrigger asChild>
                                                                    <TooltipTrigger asChild>
                                                                        <td
                                                                            onClick={() => handleCellClick(item, day, seconds)}
                                                                            className={cn(
                                                                                "border-r border-b text-center p-0 h-8",
                                                                                isWeekend(day) && "bg-muted/40",
                                                                                "cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors font-medium"
                                                                            )}
                                                                        >
                                                                            {formatHours(seconds)}
                                                                        </td>
                                                                    </TooltipTrigger>
                                                                </ContextMenuTrigger>
                                                                <ContextMenuContent>
                                                                    <ContextMenuItem onClick={() => handleCellClick(item, day, seconds)} disabled={seconds <= 0}>
                                                                        <Info className="w-4 h-4 mr-2" />
                                                                        Show Details
                                                                    </ContextMenuItem>
                                                                    <ContextMenuItem onClick={() => handleGoToDashboard(day)}>
                                                                        <ExternalLink className="w-4 h-4 mr-2" />
                                                                        Go to Dashboard
                                                                    </ContextMenuItem>
                                                                </ContextMenuContent>
                                                            </ContextMenu>
                                                            <TimeSliceTooltipContent
                                                                dateLabel={format(day, "EEEE, MMM do")}
                                                                jiraKey={item.jira_key}
                                                                description={item.description}
                                                                items={daySlices.map(s => ({
                                                                    id: s.id,
                                                                    startTime: s.start_time,
                                                                    endTime: s.end_time,
                                                                    text: s.notes
                                                                }))}
                                                            />
                                                        </Tooltip>
                                                    );
                                                })}
                                                <td className="p-2 border-b text-center font-bold bg-primary/5">
                                                    {formatHours(itemTotal)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* Summary Row */}
                                    <tr className="sticky bottom-0 bg-primary/20 backdrop-blur-md font-bold shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
                                        <td colSpan={2} className="p-2 border-r border-t bg-primary/10">TOTAL</td>
                                        {daysInMonth.map(day => {
                                            const d = getDate(day);
                                            let dayTotal = 0;
                                            activeWorkItems.forEach(item => {
                                                dayTotal += aggregation[item.id]?.[d] || 0;
                                            });
                                            return (
                                                <td
                                                    key={day.toISOString()}
                                                    className={cn(
                                                        "border-r border-t text-center h-10",
                                                        isWeekend(day) && "bg-muted/60"
                                                    )}
                                                >
                                                    {dayTotal > 0 && formatHours(dayTotal)}
                                                </td>
                                            );
                                        })}
                                        <td className="p-2 border-t text-center bg-primary/30">
                                            {formatHours(slices.reduce((acc, s) => {
                                                const start = new Date(s.start_time);
                                                const end = s.end_time ? new Date(s.end_time) : new Date();
                                                return acc + differenceInSeconds(end, start);
                                            }, 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-30">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-sm font-medium animate-pulse">Loading monthly overview...</span>
                                    </div>
                                </div>
                            )}
                            {!loading && activeWorkItems.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                                    <p className="text-lg">No time tracked in {format(currentMonth, "MMMM")}.</p>
                                    <p className="text-sm italic">Switch to the dashboard to start tracking!</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="by-connection" className="flex-1 min-h-0 mt-0 overflow-auto space-y-6">
                        {Object.entries(itemsByConnection).map(([connectionName, items]) => {
                            let connectionTotal = 0;
                            const connection = connections.find(c => c.name === connectionName);
                            const connColor = connection?.color || '#64748b';
                            return (
                                <div key={connectionName} className="border rounded-md bg-card shadow-sm overflow-hidden">
                                    <div
                                        className="p-3 font-bold text-sm border-b flex items-center gap-2"
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                                            style={{ backgroundColor: connColor }}
                                        />
                                        <span style={{ color: connColor }}>{connectionName}</span>
                                    </div>
                                    <div className="overflow-auto" onWheel={(e) => e.stopPropagation()}>
                                        <table className="w-full border-collapse text-xs table-fixed">
                                            <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-20 shadow-sm">
                                                <tr>
                                                    <th className="w-24 p-2 border-r border-b text-left bg-primary/5 font-bold">Jira Key</th>
                                                    <th className="w-64 p-2 border-r border-b text-left bg-primary/5 font-bold">Work Item</th>
                                                    {daysInMonth.map(day => (
                                                        <th
                                                            key={day.toISOString()}
                                                            className={cn(
                                                                "w-8 border-r border-b text-center font-medium",
                                                                isWeekend(day) ? "bg-muted/60 text-muted-foreground" : "bg-primary/5"
                                                            )}
                                                        >
                                                            {getDate(day)}
                                                        </th>
                                                    ))}
                                                    <th className="w-16 p-2 border-b text-center bg-primary/5 font-bold">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map(item => {
                                                    let itemTotal = 0;
                                                    return (
                                                        <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                                                            <td className="p-2 border-r border-b font-mono text-[10px] truncate">{item.jira_key || "-"}</td>
                                                            <td className="p-2 border-r border-b truncate" title={item.description}>{item.description}</td>
                                                            {daysInMonth.map(day => {
                                                                const d = getDate(day);
                                                                const seconds = aggregation[item.id]?.[d] || 0;
                                                                itemTotal += seconds;
                                                                connectionTotal += seconds;

                                                                // OPTIMIZATION: Conditional rendering
                                                                if (seconds <= 0) {
                                                                    return (
                                                                        <td
                                                                            key={day.toISOString()}
                                                                            className={cn(
                                                                                "border-r border-b text-center p-0 h-8",
                                                                                isWeekend(day) && "bg-muted/40"
                                                                            )}
                                                                        />
                                                                    );
                                                                }

                                                                const daySlices = getDaySlices(item.id, d);

                                                                return (
                                                                    <Tooltip key={day.toISOString()}>
                                                                        <ContextMenu>
                                                                            <ContextMenuTrigger asChild>
                                                                                <TooltipTrigger asChild>
                                                                                    <td
                                                                                        onClick={() => handleCellClick(item, day, seconds)}
                                                                                        className={cn(
                                                                                            "border-r border-b text-center p-0 h-8",
                                                                                            isWeekend(day) && "bg-muted/40",
                                                                                            "cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors font-medium"
                                                                                        )}
                                                                                    >
                                                                                        {formatHours(seconds)}
                                                                                    </td>
                                                                                </TooltipTrigger>
                                                                            </ContextMenuTrigger>
                                                                            <ContextMenuContent>
                                                                                <ContextMenuItem onClick={() => handleCellClick(item, day, seconds)} disabled={seconds <= 0}>
                                                                                    <Info className="w-4 h-4 mr-2" />
                                                                                    Show Details
                                                                                </ContextMenuItem>
                                                                                <ContextMenuItem onClick={() => handleGoToDashboard(day)}>
                                                                                    <ExternalLink className="w-4 h-4 mr-2" />
                                                                                    Go to Dashboard
                                                                                </ContextMenuItem>
                                                                            </ContextMenuContent>
                                                                        </ContextMenu>
                                                                        <TimeSliceTooltipContent
                                                                            dateLabel={format(day, "EEEE, MMM do")}
                                                                            jiraKey={item.jira_key}
                                                                            description={item.description}
                                                                            items={daySlices.map(s => ({
                                                                                id: s.id,
                                                                                startTime: s.start_time,
                                                                                endTime: s.end_time,
                                                                                text: s.notes
                                                                            }))}
                                                                        />
                                                                    </Tooltip>
                                                                );
                                                            })}
                                                            <td className="p-2 border-b text-center font-bold bg-primary/5">
                                                                {formatHours(itemTotal)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Connection Total Row */}
                                                <tr className="bg-primary/10 font-bold">
                                                    <td colSpan={2} className="p-2 border-r border-t">Total</td>
                                                    {daysInMonth.map(day => {
                                                        const d = getDate(day);
                                                        let dayTotal = 0;
                                                        items.forEach(item => {
                                                            dayTotal += aggregation[item.id]?.[d] || 0;
                                                        });
                                                        return (
                                                            <td
                                                                key={day.toISOString()}
                                                                className={cn(
                                                                    "border-r border-t text-center h-10",
                                                                    isWeekend(day) && "bg-muted/60"
                                                                )}
                                                            >
                                                                {dayTotal > 0 && formatHours(dayTotal)}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-2 border-t text-center bg-primary/20">
                                                        {formatHours(connectionTotal)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                        {loading && (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm font-medium animate-pulse">Loading monthly overview...</span>
                                </div>
                            </div>
                        )}
                        {!loading && Object.keys(itemsByConnection).length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                                <p className="text-lg">No time tracked in {format(currentMonth, "MMMM")}.</p>
                                <p className="text-sm italic">Switch to the dashboard to start tracking!</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="chart" className="flex-1 min-h-0 mt-0 overflow-auto">
                        <MonthlyHoursChart
                            slices={slices}
                            connections={connections}
                            daysInMonth={daysInMonth}
                        />
                    </TabsContent>

                    <TabsContent value="project-hours" className="flex-1 min-h-0 mt-0 overflow-auto">
                        <ProjectHoursChart
                            slices={slices}
                            connections={connections}
                            manualColor={manualColor}
                        />
                    </TabsContent>
                </Tabs>

                <MonthCellDialog
                    open={isDetailsOpen}
                    onOpenChange={setIsDetailsOpen}
                    workItem={selectedItem}
                    dateLabel={selectedDateLabel}
                    hours={selectedHours}
                    notes={selectedNotes}
                />
            </div>
        </TooltipProvider>
    );
}
