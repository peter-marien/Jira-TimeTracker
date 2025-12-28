import { HashRouter as Router, Routes, Route } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Dashboard } from "@/views/Dashboard/Dashboard"
import { WorkItemsView } from "@/views/WorkItems/WorkItemsView"
import { SettingsView } from "@/views/Settings/SettingsView"
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

function App() {
  useTrayEvents();
  const checkActiveTracking = useTrackingStore(state => state.checkActiveTracking);

  useEffect(() => {
    checkActiveTracking();
  }, [checkActiveTracking]);

  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/work-items" element={<WorkItemsView />} />
          <Route path="/sync" element={<SyncPlaceholder />} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
