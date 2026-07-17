import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import { DatePicker } from './date-picker'

const meta = {
  title: 'Date & Time/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  args: { placeholder: 'Choose a follow-up date' },
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<Date | undefined>(
      new Date(2026, 6, 16)
    )
    return <DatePicker {...args} value={value} onChange={setValue} />
  },
}

export const WeekdaysOnly: Story = {
  args: {
    isDateUnavailable: (date) => [0, 6].includes(date.getDay()),
    minValue: new Date(2026, 6, 1),
    maxValue: new Date(2026, 7, 31),
  },
}
