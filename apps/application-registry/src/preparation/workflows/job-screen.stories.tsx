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
    artifacts: [
      {
        artifact: parallelWorkflowJobs[0].artifacts[0],
        steps: runningWorkflowSteps,
        summary: null,
      },
      {
        artifact: parallelWorkflowJobs[0].artifacts[1],
        steps: runningWorkflowSteps,
        summary: null,
      },
    ],
    cancelError: null,
    cancelling: false,
    job: parallelWorkflowJobs[0],
    onCancel: () => undefined,
  },
} satisfies Meta<typeof WorkflowJobScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = {}

export const NeedsReview: Story = {
  args: {
    artifacts: parallelWorkflowJobs[1].artifacts.map((artifact) => ({
      artifact,
      steps: reviewWorkflowSteps,
      summary: {
        codexCalls: 8,
        revisionNumber: 3,
        tokens: 24_812,
      },
    })),
    job: parallelWorkflowJobs[1],
  },
}

export const FailedValidation: Story = {
  args: {
    artifacts: [
      {
        artifact: parallelWorkflowJobs[2].artifacts[0],
        steps: failedWorkflowSteps,
        summary: null,
      },
    ],
    job: parallelWorkflowJobs[2],
  },
}

export const CancellationFailed: Story = {
  args: {
    cancelError:
      'The local workflow runtime stopped responding while cancellation was requested.',
  },
}
