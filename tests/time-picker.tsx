import { createRoot } from 'react-dom/client'
import { TimePicker } from '../src/components/shared/TimePicker'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { Calendar } from '../src/components/ui/calendar'
import type { DateRange } from '@daypicker/react'

type Props = Omit<ComponentProps<typeof TimePicker>, 'onChange'>
declare global {
    interface Window {
        timePickerTest: {
            values: string[]
            render: (props: Props, reset?: boolean) => void
        }
        calendarSelection?: { from?: number; to?: number }
    }
}

const root = createRoot(document.getElementById('root')!)
let key = 0
window.timePickerTest = {
    values: [],
    render(props, reset = true) {
        if (reset) {
            key++
            this.values = []
        }
        root.render(<TimePicker key={key} {...props} onChange={value => window.timePickerTest.values.push(value)} />)
    },
}
window.timePickerTest.render({ value: '' })

export function CalendarFixture() {
    const [selected, setSelected] = useState<DateRange>()
    return <Calendar mode="range" defaultMonth={new Date(2026, 0, 1)} selected={selected} onSelect={range => {
        setSelected(range)
        window.calendarSelection = { from: range?.from?.getDate(), to: range?.to?.getDate() }
    }} />
}

createRoot(document.getElementById('calendar-root')!).render(<CalendarFixture />)
