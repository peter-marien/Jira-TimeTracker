import { HashRouter as Router, Routes, Route } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Dashboard } from "@/views/Dashboard/Dashboard"
import { WorkItemsView } from "@/views/WorkItems/WorkItemsView"
import { SettingsView } from "@/views/Settings/SettingsView"
import { MonthView } from "@/views/MonthView/MonthView"
import { SearchView } from "@/views/Search/SearchView"
import { AwayTimeDialog } from "@/components/Tracking/AwayTimeDialog"

import { useTrayEvents } from "@/hooks/useTrayEvents"

import { useTrackingStore } from "@/stores/useTrackingStore"
import { useEffect, useState } from "react"
import { api, WorkItem } from "@/lib/api"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

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
  const activeWorkItem = useTrackingStore(state => state.activeWorkItem);
  const handleAwayTime = useTrackingStore(state => state.handleAwayTime);

  // Away detection state
  const [awayDialogOpen, setAwayDialogOpen] = useState(false);
  const [awayData, setAwayData] = useState<{ awayStartTime: string; awayDurationSeconds: number } | null>(null);

  useEffect(() => {
    checkActiveTracking();
    // Load and apply theme on startup
    api.getSettings().then(settings => {
      const savedTheme = (settings.theme as 'light' | 'dark' | 'system') || 'dark';
      applyTheme(savedTheme);
    });
  }, [checkActiveTracking]);

  // Listen for away:detected events from main process
  useEffect(() => {
    const handleAwayDetected = (_event: unknown, data: { awayStartTime: string; awayDurationSeconds: number }) => {
      console.log('[App] Away detected:', data);
      setAwayData(data);
      setAwayDialogOpen(true);
    };

    window.ipcRenderer.on('away:detected', handleAwayDetected);

    return () => {
      window.ipcRenderer.removeListener('away:detected', handleAwayDetected);
    };
  }, []);

  const handleAwayAction = async (action: 'discard' | 'keep' | 'reassign', targetWorkItem?: WorkItem) => {
    if (awayData) {
      await handleAwayTime(action, awayData.awayStartTime, targetWorkItem);
    }
    setAwayDialogOpen(false);
    setAwayData(null);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/work-items" element={<WorkItemsView />} />
            <Route path="/month" element={<MonthView />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </Router>

      <AwayTimeDialog
        open={awayDialogOpen}
        onOpenChange={setAwayDialogOpen}
        awayDurationSeconds={awayData?.awayDurationSeconds || 0}
        awayStartTime={awayData?.awayStartTime || ''}
        currentWorkItem={activeWorkItem}
        onAction={handleAwayAction}
      />
      <Toaster position="top-center" />
    </TooltipProvider>
  )
}

export default App
