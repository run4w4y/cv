import type { Meta, StoryObj } from '@storybook/react-vite'

import { WorkflowDashboardScreen } from './dashboard-screen'
import { workflowDashboardBatches } from './story-fixtures'

const meta = {
  title: 'Application Registry/URL workflows/Dashboard',
  component: WorkflowDashboardScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    batches: workflowDashboardBatches,
    error: null,
    loading: false,
  },
} satisfies Meta<typeof WorkflowDashboardScreen>

export default meta
type Story = StoryObj<typeof meta>

/** Parallel CV and cover-letter batches with running, review, failure, and completed work. */
export const ParallelActivity: Story = {}

export const Empty: Story = {
  args: { batches: [] },
}

export const Loading: Story = {
  args: { batches: [], loading: true },
}

export const RuntimeUnavailable: Story = {
  args: {
    error:
      'The local workflow runtime could not be reached. Existing registry records remain available.',
  },
}
