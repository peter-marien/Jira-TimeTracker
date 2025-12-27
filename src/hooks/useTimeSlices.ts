import { useState, useEffect, useCallback } from "react"
import { TimeSlice, api } from "@/lib/api"
import { startOfDay, endOfDay, formatISO } from "date-fns"

export function useTimeSlices(date: Date) {
    const [slices, setSlices] = useState<TimeSlice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchSlices = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const start = formatISO(startOfDay(date));
            const end = formatISO(endOfDay(date));
            const data = await api.getTimeSlices(start, end);
            setSlices(data);
        } catch (err) {
            setError(err as Error);
            console.error("Failed to fetch time slices", err);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchSlices();
    }, [fetchSlices]);

    return { slices, loading, error, refresh: fetchSlices };
}
