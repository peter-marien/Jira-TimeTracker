import { create } from 'zustand'

interface DateStore {
    // Global State
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;

    // Persistent View States (for tab switching)
    viewDate: Date; // For MonthView
    reportYear: number; // For ReportsView

    setViewDate: (date: Date) => void;
    setReportYear: (year: number) => void;

    nextDay: () => void;
    prevDay: () => void;
}

export const useDateStore = create<DateStore>((set) => ({
    selectedDate: new Date(),
    viewDate: new Date(),
    reportYear: new Date().getFullYear(),

    setSelectedDate: (date: Date) => set({ selectedDate: date }),
    setViewDate: (date: Date) => set({ viewDate: date }),
    setReportYear: (year: number) => set({ reportYear: year }),

    nextDay: () => set((state) => {
        const next = new Date(state.selectedDate);
        next.setDate(next.getDate() + 1);
        return { selectedDate: next };
    }),
    prevDay: () => set((state) => {
        const prev = new Date(state.selectedDate);
        prev.setDate(prev.getDate() - 1);
        return { selectedDate: prev };
    }),
}))
