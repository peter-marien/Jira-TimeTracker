import * as React from "react"
import InputMask from "react-input-mask"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TimePickerProps {
    value: string; // HH:mm:ss
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
}

export function TimePicker({ value, onChange, className, disabled }: TimePickerProps) {
    const [localValue, setLocalValue] = React.useState(value || "00:00:00")

    // Update local value when prop changes
    React.useEffect(() => {
        if (value) {
            // Ensure value has seconds
            const parts = value.split(':')
            if (parts.length === 2) {
                setLocalValue(`${value}:00`)
            } else {
                setLocalValue(value)
            }
        }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setLocalValue(newValue)

        // Call onChange for valid complete time
        if (newValue.length === 8) {
            const parts = newValue.split(':')
            if (parts.length === 3) {
                const h = parseInt(parts[0], 10)
                const m = parseInt(parts[1], 10)
                const s = parseInt(parts[2], 10)

                // Validate hours (0-23), minutes (0-59), seconds (0-59)
                if (!isNaN(h) && !isNaN(m) && !isNaN(s) &&
                    h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59) {
                    onChange(newValue)
                }
            }
        }
    }

    return (
        <InputMask
            mask="99:99:99"
            value={localValue}
            onChange={handleChange}
            disabled={disabled}
            maskChar="_"
        >
            {(inputProps: React.InputHTMLAttributes<HTMLInputElement>) => (
                <Input
                    {...inputProps}
                    type="text"
                    className={cn("font-mono text-center", className)}
                    placeholder="HH:MM:SS"
                />
            )}
        </InputMask>
    )
}
