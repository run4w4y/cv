import type { Meta, StoryObj } from '@storybook/react-vite'

import { Progress } from './progress'

const meta = {
  title: 'Feedback/Progress',
  component: Progress,
  tags: ['autodocs'],
  args: {
    value: 64,
    'aria-label': 'Batch progress',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Complete: Story = {
  args: { value: 100 },
}

export const Indeterminate: Story = {
  args: {
    value: null,
    'aria-label': 'Starting workflows',
  },
}

export const WithSummary: Story = {
  render: () => (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">Batch progress</span>
        <span className="text-muted-foreground">16 of 25 jobs complete</span>
      </div>
      <Progress value={16} max={25} aria-label="16 of 25 jobs complete" />
    </div>
  ),
}
