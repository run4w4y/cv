import type {
  DocumentKind,
  PreparationActivityProjection,
} from '@cv/application-preparation-workflow/domain'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { WorkflowJobScreen } from './job-screen'
import type { WorkflowStepListItem } from './presentation'
import {
  failedWorkflowSteps,
  parallelWorkflowJobs,
  reviewWorkflowSteps,
  runningWorkflowSteps,
} from './story-fixtures'

const sharedStages = new Set([
  'queued',
  'application',
  'capture',
  'analysis',
  'evidence',
])

const activityFromSteps = (
  steps: ReadonlyArray<WorkflowStepListItem>,
  kinds: ReadonlyArray<DocumentKind>,
  branchModes: Partial<
    Readonly<Record<DocumentKind, 'completed' | 'pending'>>
  > = {}
): PreparationActivityProjection => {
  const shared = steps.filter(({ stage }) => sharedStages.has(stage))
  const artifact = steps.filter(({ stage }) => !sharedStages.has(stage))
  const nodes = [
    ...shared.map((step, index) => ({
      completedAt: step.completedAt,
      dependsOn:
        index === 0
          ? ([] as ReadonlyArray<string>)
          : [`shared:${shared[index - 1]?.stage}`],
      id: `shared:${step.stage}`,
      label: step.title,
      message: step.description,
      scope: 'shared' as const,
      stage: step.stage,
      startedAt: step.startedAt,
      status: step.status,
    })),
    ...kinds.flatMap((kind) => {
      const documentSteps =
        kind === 'cv'
          ? artifact
          : artifact.filter(({ stage }) => stage !== 'planning')
      return documentSteps.map((step, index) => {
        const mode = branchModes[kind]
        return {
          completedAt:
            mode === 'pending'
              ? null
              : mode === 'completed'
                ? (step.completedAt ?? step.startedAt)
                : step.completedAt,
          dependsOn:
            index > 0
              ? [`${kind}:${documentSteps[index - 1]?.stage}`]
              : kind === 'cover_letter' && kinds.includes('cv')
                ? ['cv:review']
                : ['shared:evidence'],
          id: `${kind}:${step.stage}`,
          label: step.title,
          message:
            mode === 'pending'
              ? 'Waiting for its document dependency.'
              : step.description,
          scope: kind,
          stage: step.stage,
          startedAt: mode === 'pending' ? null : step.startedAt,
          status: mode ?? step.status,
        }
      })
    }),
  ]
  return { events: [], nodes }
}

const meta = {
  title: 'Application Registry/AI workflows/Job detail',
  component: WorkflowJobScreen,
  tags: ['autodocs'],
  parameters: {
    controls: { exclude: ['onCancel', 'onRetry'] },
    layout: 'fullscreen',
  },
  args: {
    activity: activityFromSteps(runningWorkflowSteps, ['cv', 'cover_letter'], {
      cover_letter: 'pending',
    }),
    artifacts: [
      {
        artifact: parallelWorkflowJobs[0].artifacts[0],
        summary: null,
      },
      {
        artifact: parallelWorkflowJobs[0].artifacts[1],
        summary: null,
      },
    ],
    cancelError: null,
    cancelling: false,
    job: parallelWorkflowJobs[0],
    onCancel: () => undefined,
    onRetry: () => undefined,
    retryError: null,
    retrying: false,
  },
} satisfies Meta<typeof WorkflowJobScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = {}

export const NeedsReview: Story = {
  args: {
    activity: activityFromSteps(reviewWorkflowSteps, ['cv', 'cover_letter'], {
      cv: 'completed',
    }),
    artifacts: parallelWorkflowJobs[1].artifacts.map((artifact) => ({
      artifact,
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
    activity: activityFromSteps(failedWorkflowSteps, ['cv']),
    artifacts: [
      {
        artifact: parallelWorkflowJobs[2].artifacts[0],
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
