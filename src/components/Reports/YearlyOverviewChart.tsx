"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { format, differenceInSeconds, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getMonth } from "date-fns"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, LabelList, Legend } from "recharts"
import { TimeSlice } from "@/lib/api"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
} from "@/components/ui/chart"
import { ChartTooltipFrame } from "@/components/shared/ChartTooltipFrame"

interface YearlyOverviewChartProps {
    year: number
    slices: TimeSlice[]
}

// Constants used for configuration keys
// const ACTUAL_KEY = "actual"
// const EXPECTED_KEY = "expected"
const ACTUAL_COLOR = "hsl(var(--primary))"
const EXPECTED_COLOR = "#94a3b8" // slate-400

interface ChartDataPoint {
    monthIndex: number // 0-11
    monthLabel: string // "Jan"
    actualHours: number
    expectedHours: number
}

export function YearlyOverviewChart({ year, slices }: YearlyOverviewChartProps) {
    const chartData = useMemo(() => {
        // Initialize 12 months
        const monthsData: ChartDataPoint[] = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(year, i, 1)

            // Calculate expected hours for this month
            // Expected = Workdays (Mon-Fri) * 8
            const start = startOfMonth(date)
            const end = endOfMonth(date)
            const days = eachDayOfInterval({ start, end })
            const workDays = days.filter(d => !isWeekend(d)).length
            const expectedHours = workDays * 8

            return {
                monthIndex: i,
                monthLabel: format(date, "MMM"),
                actualHours: 0,
                expectedHours
            }
        })

        // Aggregate Actual Hours
        slices.forEach(slice => {
            const start = new Date(slice.start_time)
            // Filter by year
            if (start.getFullYear() !== year) return

            const end = slice.end_time ? new Date(slice.end_time) : new Date()
            const hours = differenceInSeconds(end, start) / 3600

            const monthIndex = getMonth(start)
            if (monthsData[monthIndex]) {
                monthsData[monthIndex].actualHours += hours
            }
        })

        // Round totals
        return monthsData.map(d => ({
            ...d,
            actualHours: Math.round(d.actualHours * 10) / 10, // Round to 1 decimal
        }))
    }, [year, slices])

    const totalActual = useMemo(() => chartData.reduce((acc, curr) => acc + curr.actualHours, 0), [chartData]);
    const totalExpected = useMemo(() => chartData.reduce((acc, curr) => acc + curr.expectedHours, 0), [chartData]);
    const totalOvertime = Math.round((totalActual - totalExpected) * 10) / 10;
    const completionPercentage = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;

    const chartConfig: ChartConfig = {
        actual: {
            label: "Actual Hours",
            color: ACTUAL_COLOR,
        },
        expected: {
            label: "Expected (8h/day)",
            color: EXPECTED_COLOR,
        },
    }

    if (slices.length === 0) {
        return (
            <div className="flex items-center justify-center h-[400px] border rounded-md bg-card">
                <p className="text-muted-foreground">No data available for {year}</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-6 p-4 border rounded-md bg-card/50">
                <div className="flex flex-col">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Total Actual</span>
                    <span className="text-2xl font-bold text-primary">{Math.round(totalActual)}h</span>
                </div>
                <div className="flex flex-col border-l pl-6">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Total Expected</span>
                    <span className="text-2xl font-bold text-muted-foreground">{totalExpected}h</span>
                </div>
                <div className="flex flex-col border-l pl-6">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Completion</span>
                    <span className="text-2xl font-bold">{completionPercentage}%</span>
                </div>
                <div className="flex flex-col border-l pl-6">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Overtime</span>
                    <span className={cn("text-2xl font-bold", totalOvertime > 0 ? "text-emerald-500" : "text-red-400")}>
                        {totalOvertime > 0 ? "+" : ""}{totalOvertime}h
                    </span>
                </div>
            </div>

            <div className="border rounded-md bg-card shadow-sm p-4">
                <ChartContainer config={chartConfig} className="h-[400px] w-full">
                    <LineChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="monthLabel"
                            tickLine={false}
                            axisLine={false}
                            className="text-sm font-medium fill-muted-foreground"
                            tickMargin={10}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            className="text-xs fill-muted-foreground"
                            tickFormatter={(value) => `${value}h`}
                            width={50}
                        />
                        <ChartTooltip
                            cursor={{ stroke: "hsl(var(--muted))", strokeWidth: 2 }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <ChartTooltipFrame
                                            header={<span className="font-semibold">{label} {year}</span>}
                                        >
                                            <div className="flex flex-col gap-2">
                                                {payload.map((entry: any) => (
                                                    <div key={entry.name} className="flex justify-between gap-8 items-center">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: entry.color }}
                                                            />
                                                            <span className="text-muted-foreground">{entry.name}</span>
                                                        </div>
                                                        <span className="font-mono font-medium">{entry.value}h</span>
                                                    </div>
                                                ))}

                                                {/* Calculate Overtime (Actual - Expected) */}
                                                {(() => {
                                                    const actual = payload.find((p: any) => p.dataKey === "actualHours")?.value || 0;
                                                    const expected = payload.find((p: any) => p.dataKey === "expectedHours")?.value || 0;
                                                    const overtime = Math.round((actual - expected) * 10) / 10;
                                                    const isPositive = overtime > 0;

                                                    // Only show if there's data
                                                    if (actual === 0 && expected === 0) return null;

                                                    return (
                                                        <>
                                                            <div className="h-px bg-border my-1" />
                                                            <div className="flex justify-between gap-8 items-center">
                                                                <span className="text-muted-foreground font-medium">Overtime</span>
                                                                <span className={`font-mono font-bold ${isPositive ? "text-emerald-500" : "text-red-400"}`}>
                                                                    {isPositive ? "+" : ""}{overtime}h
                                                                </span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </ChartTooltipFrame>
                                    )
                                }
                                return null
                            }}
                        />
                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                        <Line
                            type="linear"
                            dataKey="actualHours"
                            name="Actual Hours"
                            stroke={ACTUAL_COLOR}
                            strokeWidth={3}
                            dot={{
                                fill: ACTUAL_COLOR,
                                strokeWidth: 0,
                                r: 4,
                            }}
                            activeDot={{
                                r: 6,
                                strokeWidth: 2,
                                stroke: "hsl(var(--background))",
                            }}
                        >
                            <LabelList
                                dataKey="actualHours"
                                position="top"
                                offset={10}
                                className="fill-foreground text-[10px] font-bold"
                                formatter={(val: any) => {
                                    const num = Number(val);
                                    return num > 0 ? num : "";
                                }}
                            />
                        </Line>
                        <Line
                            type="linear"
                            dataKey="expectedHours"
                            name="Expected (8h/day)"
                            stroke={EXPECTED_COLOR}
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={{
                                fill: EXPECTED_COLOR,
                                strokeWidth: 0,
                                r: 3,
                            }}
                            activeDot={{
                                r: 5,
                                strokeWidth: 2,
                                stroke: "hsl(var(--background))",
                            }}
                        />
                    </LineChart>
                </ChartContainer>
            </div>
        </div>
    )
}
