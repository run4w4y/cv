import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { PreparationActivityProjection } from '@cv/application-preparation-workflow/domain'
import { cleanup, render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { WorkflowJobScreen } from './job-screen'
import type {
  WorkflowArtifactListItem,
  WorkflowJobListItem,
} from './presentation'

afterEach(cleanup)

const activity: PreparationActivityProjection = {
  events: [],
  nodes: [
    {
      completedAt: 2,
      dependsOn: [],
      id: 'shared:evidence',
      label: 'Select evidence',
      message: 'Evidence is ready.',
      scope: 'shared',
      stage: 'evidence',
      startedAt: 1,
      status: 'completed',
    },
    {
      completedAt: 3,
      dependsOn: ['shared:evidence'],
      id: 'cv:planning',
      label: 'Plan composition',
      message: 'Balanced CV evidence is ready.',
      scope: 'cv',
      stage: 'planning',
      startedAt: 2,
      status: 'completed',
    },
    {
      completedAt: 4,
      dependsOn: ['cv:planning'],
      id: 'cv:review',
      label: 'Review',
      message: 'The CV was approved.',
      scope: 'cv',
      stage: 'review',
      startedAt: 3,
      status: 'completed',
    },
    {
      completedAt: null,
      dependsOn: ['cv:review'],
      id: 'cover_letter:composition',
      label: 'Compose document',
      message: 'Waiting for the accepted CV.',
      scope: 'cover_letter',
      stage: 'composition',
      startedAt: null,
      status: 'pending',
    },
  ],
}

const cvArtifact = {
  error: null,
  kind: 'cv',
  message: 'The CV was approved.',
  stage: 'complete',
  status: 'approved',
} satisfies WorkflowArtifactListItem

const coverLetterArtifact = {
  error: null,
  kind: 'cover_letter',
  message: 'Waiting for the accepted CV.',
  stage: null,
  status: 'queued',
} satisfies WorkflowArtifactListItem

const job: WorkflowJobListItem = {
  applicationId: 'application-1',
  artifacts: [cvArtifact, coverLetterArtifact],
  batchId: 'batch-1',
  company: 'Example',
  createdAt: 1,
  jobId: 'job-1',
  kinds: ['cv', 'cover_letter'],
  locale: 'en',
  message: 'Preparing documents.',
  position: 0,
  role: 'Staff Engineer',
  status: 'running',
  updatedAt: 4,
  url: 'https://jobs.example.test/staff-engineer',
}

describe('WorkflowJobScreen', () => {
  test('renders shared and document lanes from dependency edges and reopens saved artifacts', () => {
    const view = render(
      <MemoryRouter>
        <WorkflowJobScreen
          activity={activity}
          artifacts={[
            {
              artifact: cvArtifact,
              summary: {
                codexCalls: 3,
                revisionNumber: 2,
                tokens: 1_200,
              },
            },
            {
              artifact: coverLetterArtifact,
              summary: null,
            },
          ]}
          cancelError={null}
          cancelling={false}
          job={job}
          onCancel={mock(() => undefined)}
          onRetry={mock(() => undefined)}
          retryError={null}
          retrying={false}
        />
      </MemoryRouter>
    )

    expect(view.getByLabelText('Shared context activity')).toBeTruthy()
    const cvLane = view.getByLabelText('CV activity')
    const coverLane = view.getByLabelText('Cover letter activity')
    expect(
      cvLane.querySelector('[data-depends-on="shared:evidence"]')
    ).toBeTruthy()
    expect(within(cvLane).getByText('Plan composition')).toBeTruthy()
    expect(within(coverLane).queryByText('Plan composition')).toBeNull()
    expect(
      coverLane.querySelector('[data-depends-on="cv:review"]')
    ).toBeTruthy()
    expect(within(coverLane).getByText('After CV · Review')).toBeTruthy()

    const openDocument = view.getByRole('link', { name: 'Open document' })
    expect(openDocument.getAttribute('href')).toBe(
      '/ai-workflows/batch-1/jobs/job-1/artifacts/cv'
    )
  })
})
