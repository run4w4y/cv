import type { Meta, StoryObj } from '@storybook/react-vite'

import { WorkflowBatchScreen } from './batch-screen'
import { parallelWorkflowBatch, parallelWorkflowJobs } from './story-fixtures'

const meta = {
  title: 'Application Registry/URL workflows/Batch overview',
  component: WorkflowBatchScreen,
  tags: ['autodocs'],
  parameters: {
    controls: {
      exclude: ['cancellingRunIds', 'onCancelAll', 'onCancelJob'],
    },
    layout: 'fullscreen',
  },
  args: {
    batch: parallelWorkflowBatch,
    cancelError: null,
    cancellingRunIds: new Set<string>(),
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
    cancellingRunIds: new Set(['run-northstar-cv']),
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
          message: 'Candidate rejected after review.',
          stage: 'complete' as const,
          status: 'rejected' as const,
        })),
        company: 'Polaris',
        jobId: 'job-polaris-completed',
        kinds: ['cv', 'cover_letter'],
        message: 'Both candidates were rejected after review.',
        primaryRunId: 'run-polaris-completed-cv',
        role: 'Principal Frontend Engineer',
        status: 'completed',
      },
    ],
  },
}
