import type { Meta, StoryObj } from '@storybook/react-vite'

import { DonutChart } from './donut-chart'

const meta: Meta<typeof DonutChart> = {
  title: 'Charts/Donut',
  component: DonutChart,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-lg rounded-lg border border-border bg-card p-5 text-card-foreground">
        <Story />
      </div>
    ),
  ],
  args: {
    ariaLabel: 'Published CV link outcomes',
    centerLabel: 'Published links',
    data: [
      { label: 'Viewed', value: 18 },
      { label: 'Not viewed', value: 7 },
      { label: 'Disabled', value: 3 },
    ],
    description: 'Published links grouped by observed traffic outcome.',
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const LinkOutcomes: Story = {}

export const Empty: Story = {
  args: { data: [] },
}
