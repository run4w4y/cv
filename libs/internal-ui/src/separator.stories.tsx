import type { Meta, StoryObj } from '@storybook/react-vite'

import { Separator } from './separator'

const meta = {
  title: 'Layout/Separator',
  component: Separator,
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="w-md">
      <p className="text-sm font-medium">Application details</p>
      <Separator className="my-3" />
      <p className="text-sm text-muted-foreground">Last updated today</p>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>List</span>
      <Separator orientation="vertical" />
      <span>Board</span>
      <Separator orientation="vertical" />
      <span>Timeline</span>
    </div>
  ),
}
