import type { Meta, StoryObj } from '@storybook/react-vite'

import { WorkflowBatchScreen } from './batch-screen'
import { parallelWorkflowBatch, parallelWorkflowJobs } from './story-fixtures'

const meta = {
  title: 'Application Registry/AI workflows/Batch overview',
  component: WorkflowBatchScreen,
  tags: ['autodocs'],
  parameters: {
    controls: {
      exclude: ['cancellingJobIds', 'onCancelAll', 'onCancelJob'],
    },
    layout: 'fullscreen',
  },
  args: {
    batch: parallelWorkflowBatch,
    cancelError: null,
    cancellingJobIds: new Set<string>(),
    jobs: parallelWorkflowJobs,
    onCancelAll: () => undefined,
    onCancelJob: () => undefined,
  },
} satisfies Meta<typeof WorkflowBatchScreen>

export default meta
type Story = StoryObj<typeof meta>

/** Six independent jobs spanning queued, running, review, failed, approved, and cancelled states. */
export const ParallelJobs: Story = {}

export const CancellingOneJob: Story = {
  args: {
    cancellingJobIds: new Set(['job-northstar']),
  },
}

export const CancellationError: Story = {
  args: {
    cancelError:
      'The workflow engine did not acknowledge the cancellation request. The job may still be running.',
  },
}

export const CompletedBatch: Story = {
  args: {
    batch: {
      ...parallelWorkflowBatch,
      active: 0,
      cancelled: 0,
      completed: 2,
      failed: 0,
      needsReview: 0,
      status: 'completed',
      total: 2,
    },
    jobs: [
      parallelWorkflowJobs[3],
      {
        ...parallelWorkflowJobs[5],
        applicationId: 'application-polaris-principal-frontend',
        artifacts: parallelWorkflowJobs[1].artifacts.map((artifact) => ({
          ...artifact,
          message: 'Candidate approved.',
          stage: 'complete' as const,
          status: 'approved' as const,
        })),
        company: 'Polaris',
        jobId: 'job-polaris-completed',
        kinds: ['cv', 'cover_letter'],
        message: 'Both candidates were approved.',
        role: 'Principal Frontend Engineer',
        status: 'completed',
      },
    ],
  },
}
