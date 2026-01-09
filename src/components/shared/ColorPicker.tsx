import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PREDEFINED_COLORS = [
    "#10b981", // emerald-500
    "#3b82f6", // blue-500
    "#6366f1", // indigo-500
    "#8b5cf6", // violet-500
    "#d946ef", // fuchsia-500
    "#f43f5e", // rose-500
    "#f97316", // orange-500
    "#f59e0b", // amber-500
    "#64748b", // slate-500
    "#000000", // black
];

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    className?: string;
}

export function ColorPicker({ color, onChange, className }: ColorPickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn("w-full h-10 px-3 justify-start gap-2", className)}
                >
                    <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: color || 'transparent' }}
                    />
                    <span className="truncate">{color || "Select color..."}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
                <div className="grid grid-cols-5 gap-2 mb-3">
                    {PREDEFINED_COLORS.map((c) => (
                        <button
                            key={c}
                            className={cn(
                                "w-8 h-8 rounded-full border border-black/10 hover:scale-110 transition-transform",
                                color === c && "ring-2 ring-primary ring-offset-2"
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() => onChange(c)}
                        />
                    ))}
                </div>
                <div className="flex gap-2">
                    <Input
                        value={color}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="#hex"
                        className="h-8"
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
