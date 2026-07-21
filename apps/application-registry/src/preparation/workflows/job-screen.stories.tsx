import type { Meta, StoryObj } from '@storybook/react-vite'

import { WorkflowJobScreen } from './job-screen'
import {
  failedWorkflowSteps,
  parallelWorkflowJobs,
  reviewWorkflowSteps,
  runningWorkflowSteps,
} from './story-fixtures'

const meta = {
  title: 'Application Registry/URL workflows/Job detail',
  component: WorkflowJobScreen,
  tags: ['autodocs'],
  parameters: {
    controls: { exclude: ['onCancel'] },
    layout: 'fullscreen',
  },
  args: {
    artifact: null,
    cancelError: null,
    cancelling: false,
    job: parallelWorkflowJobs[0],
    onCancel: () => undefined,
    steps: runningWorkflowSteps,
  },
} satisfies Meta<typeof WorkflowJobScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = {}

export const NeedsReview: Story = {
  args: {
    artifact: {
      codexCalls: 8,
      revisionNumber: 3,
      tokens: 24_812,
    },
    job: parallelWorkflowJobs[1],
    steps: reviewWorkflowSteps,
  },
}

export const FailedValidation: Story = {
  args: {
    artifact: null,
    job: parallelWorkflowJobs[2],
    steps: failedWorkflowSteps,
  },
}

export const CancellationFailed: Story = {
  args: {
    cancelError:
      'The local workflow runtime stopped responding while cancellation was requested.',
  },
}
