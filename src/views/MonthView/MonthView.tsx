import { useState, useEffect, useMemo } from "react"
import { api, WorkItem, TimeSlice, JiraConnection } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
    format,
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

export function MonthView() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [slices, setSlices] = useState<TimeSlice[]>([]);
    const [connections, setConnections] = useState<JiraConnection[]>([]);
    const [loading, setLoading] = useState(true);

    const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
    const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const startStr = monthStart.toISOString();
                const endStr = monthEnd.toISOString();

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

    return (
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
                                                return (
                                                    <td
                                                        key={day.toISOString()}
                                                        className={cn(
                                                            "border-r border-b text-center p-0 h-8",
                                                            isWeekend(day) && "bg-muted/40"
                                                        )}
                                                    >
                                                        {seconds > 0 && formatHours(seconds)}
                                                    </td>
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
                                                            return (
                                                                <td
                                                                    key={day.toISOString()}
                                                                    className={cn(
                                                                        "border-r border-b text-center p-0 h-8",
                                                                        isWeekend(day) && "bg-muted/40"
                                                                    )}
                                                                >
                                                                    {seconds > 0 && formatHours(seconds)}
                                                                </td>
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
            </Tabs>
        </div>
    );
}
