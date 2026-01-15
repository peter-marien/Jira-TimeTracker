import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Minus, Square, X, Copy, PictureInPicture2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTrackingStore } from '@/stores/useTrackingStore'
import logoLight from '/logo.svg?url'
import logoDark from '/logo-dark.svg?url'

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false)
    const [isDark, setIsDark] = useState(false)
    const { activeWorkItem, elapsedSeconds, activeTimeSliceId, startTime } = useTrackingStore()

    const isTracking = !!activeTimeSliceId

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

    // Detect dark theme
    useEffect(() => {
        const checkDark = () => {
            setIsDark(document.documentElement.classList.contains('dark'))
        }
        checkDark()

        const observer = new MutationObserver(checkDark)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])

    // Listen for mini player state request (when main window is minimized)
    useEffect(() => {
        const handleStateRequest = () => {
            api.showMiniPlayer({
                isTracking: isTracking && !!activeWorkItem,
                elapsedSeconds: isTracking ? elapsedSeconds : 0,
                jiraKey: activeWorkItem?.jira_key,
                description: activeWorkItem?.description || '',
                startTime: startTime || undefined
            })
        }

        window.ipcRenderer.on('mini-player:request-state', handleStateRequest)
        return () => {
            window.ipcRenderer.removeListener('mini-player:request-state', handleStateRequest)
        }
    }, [isTracking, activeWorkItem, elapsedSeconds, startTime])

    // Update mini player state continuously when tracking
    useEffect(() => {
        if (isTracking && activeWorkItem) {
            api.updateMiniPlayerState({
                isTracking: true,
                elapsedSeconds,
                jiraKey: activeWorkItem.jira_key,
                description: activeWorkItem.description,
                startTime: startTime || undefined
            })
        } else {
            api.updateMiniPlayerState({
                isTracking: false,
                elapsedSeconds: 0,
                description: ''
            })
        }
    }, [isTracking, activeWorkItem, elapsedSeconds, startTime])

    const handleMaximizeToggle = async () => {
        if (isMaximized) {
            await api.unmaximizeWindow()
        } else {
            await api.maximizeWindow()
        }
        setIsMaximized(!isMaximized)
    }

    const handleMinimizeToWidget = () => {
        api.showMiniPlayer({
            isTracking: isTracking && !!activeWorkItem,
            elapsedSeconds: isTracking ? elapsedSeconds : 0,
            jiraKey: activeWorkItem?.jira_key,
            description: activeWorkItem?.description || '',
            startTime: startTime || undefined
        })
        api.minimizeWindow()
    }

    const logoSrc = isDark ? logoDark : logoLight

    return (
        <div className="h-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 border-b select-none drag-region">
            <div className="flex items-center gap-2">
                <img src={logoSrc} className="w-5 h-5" alt="Icon" />
                <span className="text-xs font-semibold text-muted-foreground tracking-tight">Jira Time Tracker</span>
            </div>

            <div className="flex items-center no-drag-region">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-10 hover:bg-primary/10 hover:text-primary rounded-none"
                    onClick={handleMinimizeToWidget}
                    title="Minimize to Widget"
                >
                    <PictureInPicture2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-10 hover:bg-muted rounded-none"
                    onClick={handleMinimizeToWidget}
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

