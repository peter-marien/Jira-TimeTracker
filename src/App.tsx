import { HashRouter as Router, Routes, Route } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Dashboard } from "@/views/Dashboard/Dashboard"
import { WorkItemsView } from "@/views/WorkItems/WorkItemsView"
import { SettingsView } from "@/views/Settings/SettingsView"
import { MonthView } from "@/views/MonthView/MonthView"
import { SearchView } from "@/views/Search/SearchView"
import { AwayDialogPage } from "@/views/Away/AwayDialogPage"

import { useTrayEvents } from "@/hooks/useTrayEvents"

import { useTrackingStore } from "@/stores/useTrackingStore"
import { useEffect, useState } from "react"
import { api, WorkItem } from "@/lib/api"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

function App() {
  useTrayEvents();
  const checkActiveTracking = useTrackingStore(state => state.checkActiveTracking);
  const handleAwayTime = useTrackingStore(state => state.handleAwayTime);

  // Update state
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null);

  useEffect(() => {
    checkActiveTracking();
    // Load and apply theme on startup
    api.getSettings().then(settings => {
      const savedTheme = (settings.theme as 'light' | 'dark' | 'system') || 'dark';
      applyTheme(savedTheme);
    });
  }, [checkActiveTracking]);

  // Listen for update events
  useEffect(() => {
    const handleUpdateDownloaded = (_event: unknown, data: { version: string; releaseNotes?: string }) => {
      console.log('[App] Update downloaded:', data);
      setUpdateInfo(data);
    };

    window.ipcRenderer.on('update:downloaded', handleUpdateDownloaded);

    return () => {
      window.ipcRenderer.removeListener('update:downloaded', handleUpdateDownloaded);
    };
  }, []);

  // Listen for away actions from the standalone window
  useEffect(() => {
    const handleAwayActionForwarded = (_event: unknown, data: { action: 'discard' | 'keep' | 'reassign', awayStartTime: string, targetWorkItem?: WorkItem }) => {
      console.log('[App] Received away action:', data);
      handleAwayTime(data.action, data.awayStartTime, data.targetWorkItem);
    };

    window.ipcRenderer.on('away:action-forwarded', handleAwayActionForwarded);

    return () => {
      window.ipcRenderer.removeListener('away:action-forwarded', handleAwayActionForwarded);
    };
  }, [handleAwayTime]);

  // Listen for stop tracking command from mini player
  const stopTracking = useTrackingStore(state => state.stopTracking);
  useEffect(() => {
    const handleMiniPlayerStop = () => {
      console.log('[App] Stop tracking from mini player');
      stopTracking();
    };

    const handleMiniPlayerStart = () => {
      console.log('[App] Tracking started from mini player - refreshing state');
      checkActiveTracking();
    };

    window.ipcRenderer.on('mini-player:stop-tracking', handleMiniPlayerStop);
    window.ipcRenderer.on('mini-player:tracking-started', handleMiniPlayerStart);
    window.ipcRenderer.on('tracking:refresh', checkActiveTracking);

    return () => {
      window.ipcRenderer.removeListener('mini-player:stop-tracking', handleMiniPlayerStop);
      window.ipcRenderer.removeListener('mini-player:tracking-started', handleMiniPlayerStart);
      window.ipcRenderer.removeListener('tracking:refresh', checkActiveTracking);
    };
  }, [stopTracking, checkActiveTracking]);

  return (
    <TooltipProvider delayDuration={300}>
      <Router>
        <Routes>
          <Route path="/away" element={<AwayDialogPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/work-items" element={<WorkItemsView />} />
            <Route path="/month" element={<MonthView />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </Router>

      <AlertDialog open={!!updateInfo} onOpenChange={(open) => !open && setUpdateInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Ready</AlertDialogTitle>
            <AlertDialogDescription>
              Version {updateInfo?.version} has been downloaded and is ready to install.
              Would you like to restart and install it now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Later</AlertDialogCancel>
            <AlertDialogAction onClick={() => api.quitAndInstallUpdate()}>
              Restart Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster position="top-center" />
    </TooltipProvider>
  )
}

export default App
