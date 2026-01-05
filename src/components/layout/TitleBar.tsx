import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Minus, Square, X, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false)

    useEffect(() => {
        const checkMaximized = async () => {
            const maximized = await api.isWindowMaximized()
            setIsMaximized(maximized)
        }

        checkMaximized()

        // Poll for state changes or listen for event if we had one
        const interval = setInterval(checkMaximized, 500)
        return () => clearInterval(interval)
    }, [])

    const handleMaximizeToggle = async () => {
        if (isMaximized) {
            await api.unmaximizeWindow()
        } else {
            await api.maximizeWindow()
        }
        setIsMaximized(!isMaximized)
    }

    return (
        <div className="h-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 border-b select-none drag-region">
            <div className="flex items-center gap-2">
                <img src="/app-icon.png" className="w-5 h-5" alt="Icon" />
                <span className="text-xs font-semibold text-muted-foreground tracking-tight">Jira Time Tracker</span>
            </div>

            <div className="flex items-center no-drag-region">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-10 hover:bg-muted rounded-none"
                    onClick={() => api.minimizeWindow()}
                >
                    <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-10 hover:bg-muted rounded-none"
                    onClick={handleMaximizeToggle}
                >
                    {isMaximized ? (
                        <Copy className="h-3 w-3" />
                    ) : (
                        <Square className="h-3 w-3" />
                    )}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-10 hover:bg-destructive hover:text-destructive-foreground rounded-none"
                    onClick={() => api.closeWindow()}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
