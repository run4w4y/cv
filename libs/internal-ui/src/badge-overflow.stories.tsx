import type { Meta, StoryObj } from '@storybook/react-vite'

import { BadgeOverflow } from './badge-overflow'

const labels = ['React', 'TypeScript', 'Effect', 'Drizzle', 'Cloudflare']

const meta = {
  title: 'Data Display/Badge Overflow',
  component: BadgeOverflow<string>,
  tags: ['autodocs'],
  args: {
    items: labels,
    maxVisible: 2,
  },
} satisfies Meta<typeof BadgeOverflow<string>>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const WiderBudget: Story = {
  args: {
    maxVisible: 4,
  },
}
