import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import type { DateRange } from './calendar-utils'
import { DateRangePicker } from './date-range-picker'

const meta = {
  title: 'Date & Time/DateRangePicker',
  component: DateRangePicker,
  tags: ['autodocs'],
} satisfies Meta<typeof DateRangePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<DateRange | undefined>({
      from: new Date(2026, 6, 13),
      to: new Date(2026, 6, 24),
    })
    return <DateRangePicker {...args} value={value} onChange={setValue} />
  },
}

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Date range unavailable' },
}
