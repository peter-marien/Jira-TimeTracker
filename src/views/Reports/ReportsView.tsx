import { useState, useEffect } from "react"
import { useDateStore } from "@/stores/useDateStore"
import { api, TimeSlice } from "@/lib/api"
import { startOfYear, endOfYear, formatISO } from "date-fns"
import { YearlyOverviewChart } from "@/components/Reports/YearlyOverviewChart"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, FileBarChart } from "lucide-react"

export function ReportsView() {
    const currentYear = useDateStore(state => state.reportYear);
    const setCurrentYear = useDateStore(state => state.setReportYear);

    const [slices, setSlices] = useState<TimeSlice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch strictly for the selected year
                const start = startOfYear(new Date(currentYear, 0, 1));
                const end = endOfYear(new Date(currentYear, 0, 1));

                const startStr = formatISO(start);
                const endStr = formatISO(end);

                console.log(`[ReportsView] Fetching slices for year ${currentYear}`, { startStr, endStr });
                const fetchedSlices = await api.getTimeSlices(startStr, endStr);
                setSlices(fetchedSlices);
            } catch (err) {
                console.error("Failed to fetch year data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentYear]);

    const nextYear = () => setCurrentYear(currentYear + 1);
    const prevYear = () => setCurrentYear(currentYear - 1);

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <FileBarChart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
                        <p className="text-sm text-muted-foreground">Yearly performance overview</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentYear(new Date().getFullYear())}
                    >
                        Today
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={prevYear}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-lg font-semibold min-w-[100px] text-center">
                            {currentYear}
                        </span>
                        <Button variant="outline" size="icon" onClick={nextYear} disabled={currentYear >= new Date().getFullYear() + 1}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
                <div className="max-w-5xl mx-auto space-y-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-96 gap-4">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-muted-foreground animate-pulse">Loading year data...</span>
                        </div>
                    ) : (
                        <YearlyOverviewChart year={currentYear} slices={slices} />
                    )}
                </div>
            </div>
        </div>
    );
}
