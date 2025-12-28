import { HashRouter as Router, Routes, Route } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Dashboard } from "@/views/Dashboard/Dashboard"
import { WorkItemsView } from "@/views/WorkItems/WorkItemsView"
import { SettingsView } from "@/views/Settings/SettingsView"
import { MonthView } from "@/views/MonthView/MonthView"
// import { SyncView } from "@/views/Sync/SyncView"

// function SettingsPlaceholder() {
//   return <div className="p-8">Settings View (Coming Soon)</div>
// }

import { useTrayEvents } from "@/hooks/useTrayEvents"

function SyncPlaceholder() {
  return <div className="p-8">Sync View (Coming Soon)</div>
}

import { useTrackingStore } from "@/stores/useTrackingStore"
import { useEffect } from "react"
import { api } from "@/lib/api"

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

  useEffect(() => {
    checkActiveTracking();
    // Load and apply theme on startup
    api.getSettings().then(settings => {
      const savedTheme = (settings.theme as 'light' | 'dark' | 'system') || 'dark';
      applyTheme(savedTheme);
    });
  }, [checkActiveTracking]);

  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/work-items" element={<WorkItemsView />} />
          <Route path="/month" element={<MonthView />} />
          <Route path="/sync" element={<SyncPlaceholder />} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
