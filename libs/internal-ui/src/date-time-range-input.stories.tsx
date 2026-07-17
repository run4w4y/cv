import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import type { DateRange } from './calendar-utils'
import { DateTimeRangeInput } from './date-time-range-input'

const meta = {
  title: 'Date & Time/DateTimeRangeInput',
  component: DateTimeRangeInput,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DateTimeRangeInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<DateRange | undefined>({
      from: new Date(2026, 6, 13, 9, 0),
      to: new Date(2026, 6, 24, 18, 30),
    })
    return <DateTimeRangeInput {...args} value={value} onChange={setValue} />
  },
}

export const Empty: Story = {}
