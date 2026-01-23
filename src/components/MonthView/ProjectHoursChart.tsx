"use client"

import { useMemo } from "react"
import { differenceInSeconds } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts"
import { TimeSlice, JiraConnection } from "@/lib/api"
import { ChartTooltipFrame } from "@/components/shared/ChartTooltipFrame"

interface ProjectHoursChartProps {
    slices: TimeSlice[]
    connections: JiraConnection[]
    manualColor?: string
}

const MANUAL_CONNECTION_KEY = "manual"
// Default fallback if no prop is provided
const DEFAULT_MANUAL_COLOR = "#64748b"
const UNKNOWN_PROJECT = "Unknown"

export function ProjectHoursChart({ slices, connections, manualColor }: ProjectHoursChartProps) {
    const finalManualColor = manualColor || DEFAULT_MANUAL_COLOR;

    const data = useMemo(() => {
        // Map: ConnectionName -> ProjectPrefix -> { totalHours, workItems: Map<WorkItemId, {description, hours, jiraKey}> }
        const projectData: Record<string, Record<string, { totalHours: number, workItems: Record<number, { description: string, hours: number, jiraKey?: string }> }>> = {}

        // Helper to get connection details
        const getConnection = (name?: string) => {
            if (!name) return { name: "Manual / No Connection", color: finalManualColor }
            const conn = connections.find(c => c.name === name)
            return {
                name: conn?.name || name,
                color: conn?.color || finalManualColor
            }
        }

        slices.forEach(slice => {
            const start = new Date(slice.start_time)
            const end = slice.end_time ? new Date(slice.end_time) : new Date()
            const hours = differenceInSeconds(end, start) / 3600

            // Determine effective connection name and project
            let connName = slice.connection_name || MANUAL_CONNECTION_KEY
            let project = UNKNOWN_PROJECT

            // Logic:
            // 1. If slice has no connection (no ID or name), treated as manual.
            // 2. If Manual, do NOT extract Jira Project. Project = "Manual" (or keep UNKNOWN/Generic).
            // 3. If Connected, extract Jira Project from Key.

            const isManual = !slice.jira_connection_id && !slice.connection_name;

            if (isManual) {
                connName = MANUAL_CONNECTION_KEY;
                project = "Manual"; // Or user requested: "don't try to extract the jira project" -> group all as 'Manual'
            } else {
                // Connected item
                if (slice.jira_key) {
                    const match = slice.jira_key.match(/^([A-Z]+)-/)
                    if (match && match[1]) {
                        project = match[1]
                    }
                }
            }

            if (!projectData[connName]) {
                projectData[connName] = {}
            }
            if (!projectData[connName][project]) {
                projectData[connName][project] = { totalHours: 0, workItems: {} }
            }

            projectData[connName][project].totalHours += hours

            const workItemId = slice.work_item_id
            if (!projectData[connName][project].workItems[workItemId]) {
                projectData[connName][project].workItems[workItemId] = {
                    description: slice.work_item_description || "Unknown Task",
                    jiraKey: slice.jira_key,
                    hours: 0
                }
            }
            projectData[connName][project].workItems[workItemId].hours += hours
        })

        // Flatten to array for Recharts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chartData: any[] = []

        Object.entries(projectData).forEach(([connKey, projects]) => {
            const connDetails = getConnection(connKey === MANUAL_CONNECTION_KEY ? undefined : connKey)

            Object.entries(projects).forEach(([project, data]) => {
                if (data.totalHours > 0) {
                    const sortedWorkItems = Object.values(data.workItems)
                        .sort((a, b) => b.hours - a.hours)

                    chartData.push({
                        name: project === UNKNOWN_PROJECT ? `(${project})` : project,
                        fullName: project, // CHANGED: Just the project name now, connection is separate
                        hours: parseFloat(data.totalHours.toFixed(2)),
                        color: connDetails.color,
                        connection: connDetails.name,
                        project: project,
                        workItems: sortedWorkItems
                    })
                }
            })
        })

        return chartData.sort((a, b) => b.hours - a.hours)
    }, [slices, connections, finalManualColor])

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <p>No time tracked this month to display in project chart.</p>
            </div>
        )
    }

    // Custom Tooltip
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload
            const workItems = dataPoint.workItems as { description: string, hours: number, jiraKey?: string }[]

            return (
                <ChartTooltipFrame
                    header={
                        <div className="flex justify-between items-center gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: dataPoint.color }}
                                />
                                <span className="font-semibold">{dataPoint.fullName}</span>
                                <span className="text-[10px] text-muted-foreground font-normal">({dataPoint.connection})</span>
                            </div>
                            <span className="font-bold whitespace-nowrap">
                                {dataPoint.hours}h <span className="text-muted-foreground font-normal text-[10px] ml-1">total</span>
                            </span>
                        </div>
                    }
                >
                    <div className="space-y-1.5 mt-1">
                        <div className="mb-2">
                            <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Top Work Items</p>
                        </div>

                        {workItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between gap-3 py-0.5 items-start text-[11px]">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-1.5">
                                        {item.jiraKey && (
                                            <span className="font-mono text-[10px] font-medium shrink-0" style={{ color: dataPoint.color }}>{item.jiraKey}</span>
                                        )}
                                        <span className="truncate" title={item.description}>{item.description}</span>
                                    </div>
                                </div>
                                <span className="font-mono font-medium whitespace-nowrap opacity-80">{item.hours.toFixed(2)}h</span>
                            </div>
                        ))}
                    </div>
                </ChartTooltipFrame>
            )
        }
        return null
    }

    return (
        <div className="h-[500px] w-full p-4 border rounded-md bg-card shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" hide />
                    <YAxis
                        dataKey="name"
                        type="category"
                        width={80}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        interval={0}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} wrapperStyle={{ outline: 'none' }} />
                    <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList
                            dataKey="hours"
                            position="right"
                            className="fill-foreground text-[10px] font-medium"
                            formatter={(val: unknown) => `${val}h`}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
