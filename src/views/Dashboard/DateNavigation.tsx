import { Button } from "@/components/ui/button"
import { useDateStore } from "@/stores/useDateStore"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { format, isToday } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

export function DateNavigation({ className }: { className?: string }) {
    const { selectedDate, setSelectedDate, nextDay, prevDay } = useDateStore();

    const handleDateSelect = (date: Date | undefined) => {
        if (date) setSelectedDate(date);
    };

    return (
        <div className={cn("flex items-center gap-4", className)}>
            <div className="flex items-center gap-1">
                {!isToday(selectedDate) && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="mr-2 h-8"
                        onClick={() => setSelectedDate(new Date())}
                    >
                        Today
                    </Button>
                )}
                <Button variant="ghost" size="icon" onClick={prevDay}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleDateSelect}
                            initialFocus
                            defaultMonth={selectedDate}
                        />
                    </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" onClick={nextDay}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
