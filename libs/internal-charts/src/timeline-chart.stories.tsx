import type { Meta, StoryObj } from '@storybook/react-vite'

import { TimelineChart } from './timeline-chart'

const trafficData = [
  { date: '2026-07-12', views: 3, visitors: 2 },
  { date: '2026-07-13', views: 7, visitors: 5 },
  { date: '2026-07-14', views: 5, visitors: 4 },
  { date: '2026-07-15', views: 11, visitors: 8 },
  { date: '2026-07-16', views: 9, visitors: 7 },
  { date: '2026-07-17', views: 15, visitors: 10 },
  { date: '2026-07-18', views: 13, visitors: 9 },
]

const meta: Meta<typeof TimelineChart> = {
  title: 'Charts/Timeline',
  component: TimelineChart,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full rounded-lg border border-border bg-card p-5 text-card-foreground">
        <Story />
      </div>
    ),
  ],
  args: {
    ariaLabel: 'CV traffic over time',
    data: trafficData,
    description: 'Daily public CV link traffic for the selected period.',
    series: [
      { dataKey: 'views', label: 'Views', area: true },
      { dataKey: 'visitors', label: 'Visitors' },
    ],
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const AreaAndLine: Story = {}

export const Empty: Story = {
  args: { data: [] },
}
