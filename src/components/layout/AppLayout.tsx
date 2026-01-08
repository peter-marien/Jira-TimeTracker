import { Outlet, NavLink } from "react-router-dom"
import { LayoutDashboard, Briefcase, Settings, CalendarDays, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { TitleBar } from "./TitleBar"

export function AppLayout() {
    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
            <TitleBar />

            <div className="flex flex-1 overflow-hidden">
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
                            to="/month"
                            className={({ isActive }) => cn("p-3 rounded-md transition-colors hover:bg-accent", isActive && "bg-accent/80 text-accent-foreground")}
                            title="Month View"
                        >
                            <CalendarDays className="h-6 w-6" />
                        </NavLink>
                        <NavLink
                            to="/search"
                            className={({ isActive }) => cn("p-3 rounded-md transition-colors hover:bg-accent", isActive && "bg-accent/80 text-accent-foreground")}
                            title="Search"
                        >
                            <Search className="h-6 w-6" />
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
                <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
