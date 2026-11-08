import { createRoot } from 'react-dom/client'
import { TimePicker } from '../src/components/shared/TimePicker'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof TimePicker>, 'onChange'>
declare global {
    interface Window {
        timePickerTest: {
            values: string[]
            render: (props: Props, reset?: boolean) => void
        }
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
