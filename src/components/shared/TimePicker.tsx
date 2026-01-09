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
    const [error, setError] = React.useState(false)

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
            setError(false)
        }
    }, [value])

    const isValidTime = (time: string) => {
        const parts = time.split(':')
        if (parts.length !== 3) return false
        const h = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10)
        const s = parseInt(parts[2], 10)
        return !isNaN(h) && !isNaN(m) && !isNaN(s) &&
            h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59
    }

    const normalizeTime = (input: string) => {
        // Replace underscores with zeros for partial input
        const cleaned = input.replace(/_/g, '0')
        const parts = cleaned.split(':')

        // Ensure parts are 2 digits
        const h = (parts[0] || '00').padStart(2, '0')
        const m = (parts[1] || '00').padStart(2, '0')
        const s = (parts[2] || '00').padStart(2, '0')

        return `${h}:${m}:${s}`
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setLocalValue(newValue)

        // Only clear error if the new value *looks* like it could be valid/completable
        if (error) setError(false)

        // Still trigger onChange if it's a perfect 8 char match
        if (newValue.length === 8 && !newValue.includes('_')) {
            if (isValidTime(newValue)) {
                onChange(newValue)
            }
        }
    }

    const handleBlur = () => {
        const normalized = normalizeTime(localValue)
        if (isValidTime(normalized)) {
            setLocalValue(normalized)
            setError(false)
            onChange(normalized)
        } else {
            setError(true)
        }
    }

    return (
        <div className="flex flex-col gap-1 w-full">
            <InputMask
                mask="99:99:99"
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={disabled}
                maskChar="_"
            >
                {(inputProps: React.InputHTMLAttributes<HTMLInputElement>) => (
                    <Input
                        {...inputProps}
                        type="text"
                        className={cn(
                            "font-mono text-center transition-colors",
                            error && "border-destructive focus-visible:ring-destructive",
                            className
                        )}
                        placeholder="HH:MM:SS"
                    />
                )}
            </InputMask>
            {error && (
                <span className="text-[10px] text-destructive text-center font-medium animate-in fade-in slide-in-from-top-1">
                    Invalid time (00-23:00-59:00-59)
                </span>
            )}
        </div>
    )
}
