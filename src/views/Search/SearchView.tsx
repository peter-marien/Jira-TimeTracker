import { useState, useEffect } from "react"
import { api, TimeSlice } from "@/lib/api"
import { TimeSliceTable } from "@/views/Dashboard/TimeSliceTable"
import { EditTimeSliceDialog } from "@/components/TimeSlice/EditTimeSliceDialog"
import { SplitTimeSliceDialog } from "@/components/TimeSlice/SplitTimeSliceDialog"
import { MoveTimeSliceDialog } from "@/components/TimeSlice/MoveTimeSliceDialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { format, parseISO } from "date-fns"
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

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

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const renderPaginationItems = () => {
        const items = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                items.push(
                    <PaginationItem key={i}>
                        <PaginationLink
                            isActive={currentPage === i}
                            onClick={() => setCurrentPage(i)}
                            className="cursor-pointer"
                        >
                            {i}
                        </PaginationLink>
                    </PaginationItem>
                );
            }
        } else {
            items.push(
                <PaginationItem key={1}>
                    <PaginationLink isActive={currentPage === 1} onClick={() => setCurrentPage(1)} className="cursor-pointer">1</PaginationLink>
                </PaginationItem>
            );

            if (currentPage > 3) {
                items.push(<PaginationItem key="ellipsis-start"><PaginationEllipsis /></PaginationItem>);
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                items.push(
                    <PaginationItem key={i}>
                        <PaginationLink
                            isActive={currentPage === i}
                            onClick={() => setCurrentPage(i)}
                            className="cursor-pointer"
                        >
                            {i}
                        </PaginationLink>
                    </PaginationItem>
                );
            }

            if (currentPage < totalPages - 2) {
                items.push(<PaginationItem key="ellipsis-end"><PaginationEllipsis /></PaginationItem>);
            }

            items.push(
                <PaginationItem key={totalPages}>
                    <PaginationLink isActive={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
                </PaginationItem>
            );
        }
        return items;
    };

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
        <div className="flex flex-col h-full bg-background overflow-hidden" onWheel={(e) => e.stopPropagation()}>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-0 h-full">
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
                        <TimeSliceTable
                            slices={slices}
                            onEdit={setEditSlice}
                            onSplit={setSplitSlice}
                            onMove={setMoveSlice}
                            onDelete={setDeleteSlice}
                            onResume={handleResume}
                            onCopy={handleCopy}
                            onDoubleClick={handleDoubleClick}
                            showDate={true}
                        />

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-2 py-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                                {Math.min(totalCount, currentPage * itemsPerPage)} of {totalCount} results
                            </div>
                            {totalPages > 1 && (
                                <Pagination className="mx-0 w-auto">
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")}
                                            />
                                        </PaginationItem>

                                        {renderPaginationItems()}

                                        <PaginationItem>
                                            <PaginationNext
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")}
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground py-20">
                        Enter a search term to find time slices.
                    </div>
                )}
            </div>

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
