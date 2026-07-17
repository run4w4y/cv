import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import { DateInput } from './date-input'

const meta = {
  title: 'Date & Time/DateInput',
  component: DateInput,
  tags: ['autodocs'],
} satisfies Meta<typeof DateInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<Date | undefined>(
      new Date(2026, 6, 16)
    )
    return <DateInput {...args} value={value} onChange={setValue} />
  },
}

export const Empty: Story = {}
export const Disabled: Story = {
  args: { disabled: true, defaultValue: new Date(2026, 6, 16) },
}
