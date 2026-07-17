import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import type { DateRange } from './calendar-utils'
import { DateRangeInput } from './date-range-input'

const meta = {
  title: 'Date & Time/DateRangeInput',
  component: DateRangeInput,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DateRangeInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<DateRange | undefined>({
      from: new Date(2026, 6, 13),
      to: new Date(2026, 6, 24),
    })
    return <DateRangeInput {...args} value={value} onChange={setValue} />
  },
}

export const Empty: Story = {}
