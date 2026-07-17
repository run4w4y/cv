import type { Meta, StoryObj } from '@storybook/react-vite'

import { EventKindBadge } from './render'

const meta = {
  title: 'Application Registry/Event kind badge',
  component: EventKindBadge,
  tags: ['autodocs'],
  args: { kind: 'interview_scheduled' },
} satisfies Meta<typeof EventKindBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Interview: Story = {}
export const Offer: Story = { args: { kind: 'offer_received' } }
export const Rejected: Story = { args: { kind: 'rejected' } }
