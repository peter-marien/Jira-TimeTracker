import { create } from 'zustand'

interface DateStore {
    // Persistent View States (for tab switching)
    viewDate: Date; // For MonthView
    reportYear: number; // For ReportsView

    setViewDate: (date: Date) => void;
    setReportYear: (year: number) => void;
}

export const useDateStore = create<DateStore>((set) => ({
    selectedDate: new Date(),
    viewDate: new Date(),
    reportYear: new Date().getFullYear(),

    setSelectedDate: (date) => set({ selectedDate: date }),
    setViewDate: (date) => set({ viewDate: date }),
    setReportYear: (year) => set({ reportYear: year }),

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
