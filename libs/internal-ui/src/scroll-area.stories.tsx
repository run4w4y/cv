import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from './badge'
import { ScrollArea } from './scroll-area'

const jobs = Array.from({ length: 18 }, (_, index) => ({
  id: `job-${index + 1}`,
  name: `Job ${String(index + 1).padStart(2, '0')}`,
  status: index % 4 === 0 ? 'Needs review' : 'Running',
}))

const meta = {
  title: 'Layout/Scroll Area',
  component: ScrollArea,
  tags: ['autodocs'],
} satisfies Meta<typeof ScrollArea>

export default meta
type Story = StoryObj<typeof meta>

export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-72 w-80 rounded-md border border-border bg-card">
      <div className="grid gap-1 p-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm hover:bg-muted"
          >
            <span className="font-medium">{job.name}</span>
            <span className="text-xs text-muted-foreground">{job.status}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
}

export const Horizontal: Story = {
  render: () => (
    <ScrollArea
      orientation="horizontal"
      className="w-96 rounded-md border border-border bg-card"
      contentClassName="w-max"
    >
      <div className="flex gap-2 p-4">
        {jobs.slice(0, 12).map((job) => (
          <Badge key={job.id} variant="outline" className="whitespace-nowrap">
            {job.name}
          </Badge>
        ))}
      </div>
    </ScrollArea>
  ),
}
