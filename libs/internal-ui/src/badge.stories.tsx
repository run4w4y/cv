import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from './badge'

const meta = {
  title: 'Data Display/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    children: 'In progress',
    variant: 'default',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'outline',
        'success',
        'warning',
        'danger',
      ],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Applied</Badge>
      <Badge variant="secondary">Draft</Badge>
      <Badge variant="outline">Archived</Badge>
      <Badge variant="success">Offer</Badge>
      <Badge variant="warning">Interview</Badge>
      <Badge variant="danger">Rejected</Badge>
    </div>
  ),
}
