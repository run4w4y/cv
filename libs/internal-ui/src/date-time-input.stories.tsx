import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import { DateTimeInput } from './date-time-input'

const meta = {
  title: 'Date & Time/DateTimeInput',
  component: DateTimeInput,
  tags: ['autodocs'],
} satisfies Meta<typeof DateTimeInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<Date | undefined>(
      new Date(2026, 6, 16, 10, 30)
    )
    return <DateTimeInput {...args} value={value} onChange={setValue} />
  },
}

export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: new Date(2026, 6, 16, 10, 30) },
}
