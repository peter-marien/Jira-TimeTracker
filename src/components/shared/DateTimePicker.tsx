import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { TimePicker } from "@/components/shared/TimePicker"

interface DateTimePickerProps {
    value?: Date
    onChange?: (date: Date | undefined) => void
    disabled?: boolean
    placeholder?: string
}

export function DateTimePicker({
    value,
    onChange,
    disabled,
    placeholder = "Pick a date and time"
}: DateTimePickerProps) {
    const [date, setDate] = React.useState<Date | undefined>(value)
    const [timeValue, setTimeValue] = React.useState<string>(
        value ? format(value, "HH:mm") : "00:00"
    )

    React.useEffect(() => {
        if (value) {
            setDate(value)
            setTimeValue(format(value, "HH:mm"))
        }
    }, [value])

    const handleDateSelect = (selectedDate: Date | undefined) => {
        if (!selectedDate) {
            setDate(undefined)
            onChange?.(undefined)
            return
        }

        // Preserve the time when changing the date
        const [hours, minutes] = timeValue.split(':').map(Number)
        const newDate = new Date(selectedDate)
        newDate.setHours(hours, minutes, 0, 0)

        setDate(newDate)
        onChange?.(newDate)
    }

    const handleTimeChange = (newTime: string) => {
        setTimeValue(newTime)

        if (!date) return

        const [hours, minutes] = newTime.split(':').map(Number)
        const newDate = new Date(date)
        newDate.setHours(hours, minutes, 0, 0)

        setDate(newDate)
        onChange?.(newDate)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? (
                        <span className="flex items-center gap-2">
                            {format(date, "PPP")}
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {format(date, "HH:mm")}
                        </span>
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    initialFocus
                />
                <div className="p-3 border-t border-border">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <TimePicker
                            value={timeValue}
                            onChange={handleTimeChange}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
