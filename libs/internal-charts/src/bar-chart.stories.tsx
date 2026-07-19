import type { Meta, StoryObj } from '@storybook/react-vite'

import { BarChart } from './bar-chart'

const meta: Meta<typeof BarChart> = {
  title: 'Charts/Bar',
  component: BarChart,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full rounded-lg border border-border bg-card p-5 text-card-foreground">
        <Story />
      </div>
    ),
  ],
  args: {
    ariaLabel: 'Applications by current status',
    data: [
      { label: 'Prepared', value: 8 },
      { label: 'Applied', value: 14 },
      { label: 'Interview', value: 5 },
      { label: 'Rejected', value: 6 },
      { label: 'Offer', value: 2 },
    ],
    description: 'Current application count grouped by lifecycle status.',
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Pipeline: Story = {}

export const WithoutLegend: Story = {
  args: { showLegend: false },
}
