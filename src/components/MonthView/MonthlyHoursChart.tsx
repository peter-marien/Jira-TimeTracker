"use client"

import { useMemo } from "react"
import { format, getDate, differenceInSeconds } from "date-fns"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, LabelList } from "recharts"
import { TimeSlice, JiraConnection } from "@/lib/api"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

interface MonthlyHoursChartProps {
    slices: TimeSlice[]
    connections: JiraConnection[]
    daysInMonth: Date[]
}

const MANUAL_CONNECTION_KEY = "manual"
const TOTAL_KEY = "total"
const MANUAL_COLOR = "#64748b" // slate-500
const TOTAL_COLOR = "hsl(var(--primary))"

interface ChartDataPoint {
    day: number
    dayLabel: string  // e.g., "1 Mon"
    date: string
    hours: number
}

interface ChartSection {
    key: string
    label: string
    color: string
    data: ChartDataPoint[]
    hasData: boolean
}

export function MonthlyHoursChart({ slices, connections, daysInMonth }: MonthlyHoursChartProps) {
    // Build chart sections: one per connection + manual + total
    const chartSections = useMemo(() => {
        // Initialize data structure for each day per section
        const sectionDataMap: Record<string, Record<number, number>> = {
            [TOTAL_KEY]: {},
            [MANUAL_CONNECTION_KEY]: {},
        }

        connections.forEach(conn => {
            sectionDataMap[conn.name] = {}
        })

        // Initialize all days with 0
        daysInMonth.forEach(day => {
            const d = getDate(day)
            sectionDataMap[TOTAL_KEY][d] = 0
            sectionDataMap[MANUAL_CONNECTION_KEY][d] = 0
            connections.forEach(conn => {
                sectionDataMap[conn.name][d] = 0
            })
        })

        // Aggregate slices
        slices.forEach(slice => {
            const start = new Date(slice.start_time)
            const end = slice.end_time ? new Date(slice.end_time) : new Date()
            const day = getDate(start)
            const hours = differenceInSeconds(end, start) / 3600

            if (sectionDataMap[TOTAL_KEY][day] !== undefined) {
                const connectionName = slice.connection_name || MANUAL_CONNECTION_KEY

                // Add to connection (or manual)
                if (!slice.connection_name) {
                    sectionDataMap[MANUAL_CONNECTION_KEY][day] += hours
                } else if (sectionDataMap[connectionName]) {
                    sectionDataMap[connectionName][day] += hours
                }

                // Add to total
                sectionDataMap[TOTAL_KEY][day] += hours
            }
        })

        // Build sections array
        const sections: ChartSection[] = []

        // Total chart first
        const totalData = daysInMonth.map(day => {
            const d = getDate(day)
            return {
                day: d,
                dayLabel: `${format(day, "EEE")} ${d}`,
                date: format(day, "MMM d"),
                hours: parseFloat(sectionDataMap[TOTAL_KEY][d].toFixed(2))
            }
        })
        const totalHasData = totalData.some(d => d.hours > 0)
        sections.push({
            key: TOTAL_KEY,
            label: "Total Hours",
            color: TOTAL_COLOR,
            data: totalData,
            hasData: totalHasData
        })

        // Connection charts
        connections.forEach(conn => {
            const connData = daysInMonth.map(day => {
                const d = getDate(day)
                return {
                    day: d,
                    dayLabel: `${format(day, "EEE")} ${d}`,
                    date: format(day, "MMM d"),
                    hours: parseFloat((sectionDataMap[conn.name]?.[d] || 0).toFixed(2))
                }
            })
            const connHasData = connData.some(d => d.hours > 0)
            if (connHasData) {
                sections.push({
                    key: conn.name,
                    label: conn.name,
                    color: conn.color || "#8884d8",
                    data: connData,
                    hasData: connHasData
                })
            }
        })

        // Manual / No Connection chart
        const manualData = daysInMonth.map(day => {
            const d = getDate(day)
            return {
                day: d,
                dayLabel: `${format(day, "EEE")} ${d}`,
                date: format(day, "MMM d"),
                hours: parseFloat(sectionDataMap[MANUAL_CONNECTION_KEY][d].toFixed(2))
            }
        })
        const manualHasData = manualData.some(d => d.hours > 0)
        if (manualHasData) {
            sections.push({
                key: MANUAL_CONNECTION_KEY,
                label: "Manual / No Connection",
                color: MANUAL_COLOR,
                data: manualData,
                hasData: manualHasData
            })
        }

        return sections
    }, [slices, connections, daysInMonth])

    const sectionsWithData = chartSections.filter(s => s.hasData)

    if (sectionsWithData.length === 0) {
        return (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <p>No time tracked this month to display in chart.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-4">
            {sectionsWithData.map((section) => {
                const chartConfig: ChartConfig = {
                    hours: {
                        label: section.label,
                        color: section.color,
                    },
                }

                return (
                    <div key={section.key} className="border rounded-md bg-card shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div
                                className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                                style={{ backgroundColor: section.color }}
                            />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">
                                {section.label}
                            </h3>
                        </div>
                        <ChartContainer config={chartConfig} className="h-[200px] w-full">
                            <LineChart
                                data={section.data}
                                margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="dayLabel"
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs fill-muted-foreground"
                                    tickMargin={8}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                    height={50}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs fill-muted-foreground"
                                    tickFormatter={(value) => `${value}h`}
                                    width={40}
                                />
                                <ChartTooltip
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={(value: string | number, payload: Array<{ payload?: { date?: string } }>) => {
                                                if (payload?.[0]?.payload?.date) {
                                                    return payload[0].payload.date
                                                }
                                                return `Day ${value}`
                                            }}
                                            formatter={(value: number) => (
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-muted-foreground">{section.label}</span>
                                                    <span className="font-mono font-medium">{value}h</span>
                                                </div>
                                            )}
                                        />
                                    }
                                />
                                <Line
                                    type="linear"
                                    dataKey="hours"
                                    stroke={section.color}
                                    strokeWidth={2}
                                    dot={{
                                        fill: section.color,
                                        strokeWidth: 0,
                                        r: 3,
                                    }}
                                    activeDot={{
                                        r: 6,
                                        strokeWidth: 2,
                                        stroke: "hsl(var(--background))",
                                    }}
                                >
                                    <LabelList
                                        dataKey="hours"
                                        position="top"
                                        offset={8}
                                        className="fill-foreground text-[10px] font-medium"
                                        formatter={(value) => {
                                            const numVal = Number(value)
                                            return numVal > 0 ? `${numVal}h` : ""
                                        }}
                                    />
                                </Line>
                            </LineChart>
                        </ChartContainer>
                    </div>
                )
            })}
        </div>
    )
}
