import { useState, useEffect } from "react"
import { api, TimeSlice } from "@/lib/api"
import { TimeSliceTable } from "@/views/Dashboard/TimeSliceTable"
import { EditTimeSliceDialog } from "@/components/TimeSlice/EditTimeSliceDialog"
import { SplitTimeSliceDialog } from "@/components/TimeSlice/SplitTimeSliceDialog"
import { MoveTimeSliceDialog } from "@/components/TimeSlice/MoveTimeSliceDialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { format, parseISO } from "date-fns"

export function SearchView() {
    const navigate = useNavigate();

    const [query, setQuery] = useState("");
    const [slices, setSlices] = useState<TimeSlice[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 50;

    // Dialogs
    const [editSlice, setEditSlice] = useState<TimeSlice | null>(null);
    const [splitSlice, setSplitSlice] = useState<TimeSlice | null>(null);
    const [moveSlice, setMoveSlice] = useState<TimeSlice | null>(null);
    const [deleteSlice, setDeleteSlice] = useState<TimeSlice | null>(null);

    const fetchResults = async () => {
        if (!query.trim()) {
            setSlices([]);
            setTotalCount(0);
            return;
        }

        setLoading(true);
        try {
            const offset = (currentPage - 1) * itemsPerPage;
            const [data, count] = await Promise.all([
                api.searchTimeSlices({ query, limit: itemsPerPage, offset }),
                api.searchTimeSlicesCount({ query })
            ]);
            setSlices(data);
            setTotalCount(count);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search
    useEffect(() => {
        setCurrentPage(1);
    }, [query]);

    useEffect(() => {
        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, currentPage]);

    const handleDoubleClick = (slice: TimeSlice) => {
        const date = parseISO(slice.start_time);
        const dateStr = format(date, 'yyyy-MM-dd');
        navigate(`/?date=${dateStr}`);
    };

    const handleResume = async (slice: TimeSlice) => {
        const now = new Date().toISOString();
        await api.saveTimeSlice({
            work_item_id: slice.work_item_id,
            start_time: now,
        });
        // Optionally navigate to dashboard
        navigate('/');
    };

    const handleCopy = async (slice: TimeSlice) => {
        const now = new Date();
        await api.saveTimeSlice({
            work_item_id: slice.work_item_id,
            start_time: now.toISOString(),
            end_time: now.toISOString(),
            notes: slice.notes,
        });
        fetchResults();
    };

    const handleDelete = async () => {
        if (deleteSlice) {
            await api.deleteTimeSlice(deleteSlice.id);
            setDeleteSlice(null);
            fetchResults();
        }
    };

    return (
        <div className="flex flex-col h-full bg-background p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Search Time Slices</h1>
            </div>

            <div className="flex items-center gap-2 max-w-md border rounded-md px-3 bg-muted/50">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="Search notes, description, or Jira key..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {query.trim() ? (
                <>
                    <div className="flex-1 overflow-y-auto">
                        <TimeSliceTable
                            slices={slices}
                            onEdit={setEditSlice}
                            onSplit={setSplitSlice}
                            onMove={setMoveSlice}
                            onDelete={setDeleteSlice}
                            onResume={handleResume}
                            onCopy={handleCopy}
                            onDoubleClick={handleDoubleClick}
                        />
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-2">
                        <div className="text-sm text-muted-foreground">
                            Showing {totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                            {Math.min(totalCount, currentPage * itemsPerPage)} of {totalCount} results
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || loading}
                            >
                                Previous
                            </Button>
                            <div className="text-sm font-medium w-20 text-center">
                                Page {currentPage}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage * itemsPerPage >= totalCount || loading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Enter a search term to find time slices.
                </div>
            )}

            <EditTimeSliceDialog
                open={!!editSlice}
                onOpenChange={open => !open && setEditSlice(null)}
                slice={editSlice}
                onSave={fetchResults}
            />
            <SplitTimeSliceDialog
                open={!!splitSlice}
                onOpenChange={open => !open && setSplitSlice(null)}
                slice={splitSlice}
                onSave={fetchResults}
            />
            <MoveTimeSliceDialog
                open={!!moveSlice}
                onOpenChange={(open) => !open && setMoveSlice(null)}
                slice={moveSlice}
                onSave={fetchResults}
            />
            <ConfirmDialog
                open={!!deleteSlice}
                onOpenChange={(open) => !open && setDeleteSlice(null)}
                onConfirm={handleDelete}
                title="Delete Time Slice?"
                description={`Are you sure you want to delete this time slice from ${deleteSlice ? format(parseISO(deleteSlice.start_time), 'HH:mm') : ''}?`}
                confirmText="Delete"
                variant="destructive"
            />
        </div>
    )
}
