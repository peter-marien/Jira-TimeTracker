import React from "react"
import { cn } from "@/lib/utils"

interface ChartTooltipFrameProps {
    className?: string
    header?: React.ReactNode
    children: React.ReactNode
}

/**
 * A unified wrapper for Recharts tooltips to match the application's Tooltip design.
 * Provides the standard container styles (bg-popover, shadow, border) and specific header styling.
 */
export function ChartTooltipFrame({ className, header, children }: ChartTooltipFrameProps) {
    return (
        <div className={cn(
            "bg-popover border text-popover-foreground shadow-md rounded-md overflow-hidden text-xs max-w-[400px]",
            className
        )}>
            {header && (
                <div className="bg-muted/50 px-3 py-2 border-b border-border font-medium">
                    {header}
                </div>
            )}
            <div className="p-3">
                {children}
            </div>
        </div>
    )
}
