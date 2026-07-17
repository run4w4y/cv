import type { Meta, StoryObj } from '@storybook/react-vite'

import { FitScore } from './render'

const meta = {
  title: 'Application Registry/Fit score',
  component: FitScore,
  tags: ['autodocs'],
  args: { score: 91 },
} satisfies Meta<typeof FitScore>

export default meta
type Story = StoryObj<typeof meta>

export const Excellent: Story = {}
export const Strong: Story = { args: { score: 82 } }
export const Moderate: Story = { args: { score: 63 } }
export const NotAssessed: Story = { args: { score: null } }
