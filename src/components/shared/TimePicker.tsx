import * as React from "react"
import InputMask from "react-input-mask"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface TimePickerProps {
    value: string; // HH:mm:ss or empty for "active/now"
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
    allowEmpty?: boolean;
}

export function TimePicker({ value, onChange, className, disabled, allowEmpty = false }: TimePickerProps) {
    const [localValue, setLocalValue] = React.useState(value || "")
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
        } else if (allowEmpty && value === "") {
            setLocalValue("")
            setError(false)
        }
    }, [value, allowEmpty])

    const isValidTime = (time: string) => {
        if (allowEmpty && time === "") return true;

        const parts = time.split(':')
        if (parts.length !== 3) return false
        const h = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10)
        const s = parseInt(parts[2], 10)
        return !isNaN(h) && !isNaN(m) && !isNaN(s) &&
            h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59
    }

    const normalizeTime = (input: string) => {
        if (allowEmpty && (input === "" || input === "__:__:__")) return "";

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

        if (allowEmpty && (newValue === "" || newValue === "__:__:__")) {
            onChange("")
            return
        }

        // Still trigger onChange if it's a perfect 8 char match
        if (newValue.length === 8 && !newValue.includes('_')) {
            if (isValidTime(newValue)) {
                onChange(newValue)
            }
        }
    }

    const handleBlur = () => {
        if (allowEmpty && (localValue === "" || localValue === "__:__:__")) {
            setLocalValue("")
            setError(false)
            onChange("")
            return
        }

        const normalized = normalizeTime(localValue)
        if (isValidTime(normalized)) {
            setLocalValue(normalized)
            setError(false)
            onChange(normalized)
        } else {
            setError(true)
        }
    }

    const handleClear = () => {
        setLocalValue("")
        setError(false)
        onChange("")
    }

    return (
        <div className="flex flex-col gap-1 w-full relative group/timepicker">
            <div className="relative">
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
                                "font-mono text-center transition-colors pr-8", // added padding for button
                                error && "border-destructive focus-visible:ring-destructive",
                                className
                            )}
                            placeholder={allowEmpty ? "Active" : "HH:MM:SS"}
                        />
                    )}
                </InputMask>
                {allowEmpty && localValue && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
                        tabIndex={-1}
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>
            {error && (
                <span className="text-[10px] text-destructive text-center font-medium animate-in fade-in slide-in-from-top-1">
                    Invalid time (00-23:00-59:00-59)
                </span>
            )}
        </div>
    )
}
