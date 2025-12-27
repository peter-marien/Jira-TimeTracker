import { Outlet, NavLink } from "react-router-dom"
import { LayoutDashboard, Briefcase, Settings, ArrowLeftRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function AppLayout() {
    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar */}
            <aside className="w-16 flex flex-col items-center py-4 border-r bg-muted/20">
                <nav className="flex flex-col gap-4">
                    <NavLink
                        to="/"
                        className={({ isActive }) => cn("p-3 rounded-md transition-colors hover:bg-accent", isActive && "bg-accent/80 text-accent-foreground")}
                        title="Dashboard"
                    >
                        <LayoutDashboard className="h-6 w-6" />
                    </NavLink>
                    <NavLink
                        to="/work-items"
                        className={({ isActive }) => cn("p-3 rounded-md transition-colors hover:bg-accent", isActive && "bg-accent/80 text-accent-foreground")}
                        title="Work Items"
                    >
                        <Briefcase className="h-6 w-6" />
                    </NavLink>
                    <NavLink
                        to="/sync"
                        className={({ isActive }) => cn("p-3 rounded-md transition-colors hover:bg-accent", isActive && "bg-accent/80 text-accent-foreground")}
                        title="Sync to Jira"
                    >
                        <ArrowLeftRight className="h-6 w-6" />
                    </NavLink>
                </nav>

                <div className="flex-1" />

                <nav className="flex flex-col gap-4">
                    <NavLink
                        to="/settings"
                        className={({ isActive }) => cn("p-3 rounded-md transition-colors hover:bg-accent", isActive && "bg-accent/80 text-accent-foreground")}
                        title="Settings"
                    >
                        <Settings className="h-6 w-6" />
                    </NavLink>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                <Outlet />
            </main>
        </div>
    )
}
