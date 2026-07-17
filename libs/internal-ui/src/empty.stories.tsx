import type { Meta, StoryObj } from '@storybook/react-vite'
import { Inbox } from 'lucide-react'

import { Button } from './button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './empty'

const meta = {
  title: 'Feedback/Empty',
  component: Empty,
  tags: ['autodocs'],
} satisfies Meta<typeof Empty>

export default meta
type Story = StoryObj<typeof meta>

export const NoApplications: Story = {
  render: () => (
    <Empty className="w-xl">
      <EmptyHeader>
        <EmptyMedia>
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>No applications found</EmptyTitle>
        <EmptyDescription>
          Adjust your filters or register a new application.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>Create application</Button>
        <Button variant="outline">Clear filters</Button>
      </EmptyContent>
    </Empty>
  ),
}
