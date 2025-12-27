import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimePickerProps {
    value: string; // HH:mm
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
}

export function TimePicker({ value, onChange, className, disabled }: TimePickerProps) {
    const [hours, minutes] = value ? value.split(':') : ['00', '00'];

    const setHours = (newHours: string) => {
        onChange(`${newHours}:${minutes}`);
    };

    const setMinutes = (newMinutes: string) => {
        onChange(`${hours}:${newMinutes}`);
    };

    const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className="flex-1">
                <Select value={hours} onValueChange={setHours} disabled={disabled}>
                    <SelectTrigger className="h-9 font-mono">
                        <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent>
                        {hourOptions.map(h => (
                            <SelectItem key={h} value={h} className="font-mono">
                                {h}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <span className="text-muted-foreground font-bold">:</span>
            <div className="flex-1">
                <Select value={minutes} onValueChange={setMinutes} disabled={disabled}>
                    <SelectTrigger className="h-9 font-mono">
                        <SelectValue placeholder="mm" />
                    </SelectTrigger>
                    <SelectContent>
                        {minuteOptions.map(m => (
                            <SelectItem key={m} value={m} className="font-mono">
                                {m}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
