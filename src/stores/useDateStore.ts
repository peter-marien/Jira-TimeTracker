import { create } from 'zustand'

interface DateStore {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    nextDay: () => void;
    prevDay: () => void;
}

export const useDateStore = create<DateStore>((set) => ({
    selectedDate: new Date(),
    setSelectedDate: (date) => set({ selectedDate: date }),
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
