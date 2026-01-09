"use client"

import { Bar, BarChart, XAxis, YAxis, LabelList } from "recharts"
import {
    ChartConfig,
    ChartContainer,
} from "@/components/ui/chart"

export interface ConnectionData {
    name: string
    minutes: number
    fill: string
}

interface JiraConnectionChartProps {
    data: ConnectionData[]
}

export function JiraConnectionChart({ data }: JiraConnectionChartProps) {
    // Config for labels and colors
    const chartConfig = {
        minutes: {
            label: "Minutes",
        },
        ...data.reduce((acc, curr, index) => {
            acc[`conn_${index}`] = {
                label: curr.name,
                color: curr.fill
            }
            return acc
        }, {} as ChartConfig)
    } satisfies ChartConfig

    // Format data for Recharts - horizontal bars expect connection on Y axis
    const displayData = data.map((item, index) => {
        const h = Math.floor(item.minutes / 60);
        const m = Math.floor(item.minutes % 60);
        return {
            name: item.name,
            minutes: Math.round(item.minutes),
            hours: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            fill: item.fill,
            configKey: `conn_${index}`
        };
    })

    return (
        <div className="w-full max-w-[400px] flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-1">Total hours/connection</h3>
            <ChartContainer config={chartConfig} className="min-h-[100px] h-[88px] w-full">
                <BarChart
                    accessibilityLayer
                    data={displayData}
                    layout="vertical"
                    margin={{
                        left: 0,
                        right: 40, // space for label
                        top: 5,
                        bottom: 5
                    }}
                    barSize={24}
                >
                    <XAxis type="number" dataKey="minutes" hide />
                    <YAxis
                        dataKey="name"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        className="text-[10px] font-medium fill-muted-foreground"
                        width={90}
                    />
                    <Bar
                        dataKey="minutes"
                        radius={4}
                        isAnimationActive={false}
                    >
                        <LabelList
                            dataKey="hours"
                            position="right"
                            offset={8}
                            className="fill-foreground font-bold text-[12px]"
                        />
                    </Bar>
                </BarChart>
            </ChartContainer>
        </div>
    )
}
