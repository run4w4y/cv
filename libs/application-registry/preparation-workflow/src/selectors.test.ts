import { describe, expect, test } from 'bun:test'

import type {
  DocumentKind,
  PreparationArtifact,
  PreparationJob,
} from './domain'
import {
  latestApplicationJob,
  preparationActivityProjection,
  selectPreparationBatches,
  selectPreparationJob,
} from './selectors'

const artifact = (
  kind: DocumentKind,
  updatedAt: number,
  status: PreparationArtifact['status'] = 'running'
): PreparationArtifact => ({
  candidate: null,
  error: null,
  history: [
    {
      message: 'Preparing document.',
      occurredAt: updatedAt,
      stage: kind === 'cv' ? 'planning' : 'composition',
      status: status === 'failed' ? 'failed' : 'running',
    },
  ],
  kind,
  message: 'Preparing document.',
  stage: kind === 'cv' ? 'planning' : 'composition',
  status,
  updatedAt,
})

const job = (
  jobId: string,
  options: {
    readonly applicationId?: string
    readonly batchId?: string
    readonly batchPosition?: number
    readonly createdAt?: number
    readonly status?: PreparationJob['status']
    readonly withCoverLetter?: boolean
  } = {}
): PreparationJob => {
  const createdAt = options.createdAt ?? 10
  return {
    applicationId: options.applicationId ?? 'application-1',
    artifacts: {
      coverLetter:
        options.withCoverLetter === true
          ? artifact('cover_letter', createdAt + 5)
          : null,
      cv: artifact('cv', createdAt + 4),
    },
    batchId: options.batchId ?? 'batch-1',
    batchPosition: options.batchPosition ?? 0,
    company: 'Example',
    createdAt,
    error: null,
    jobId,
    locale: 'en',
    message: 'Planning sections.',
    retryOfJobId: null,
    role: 'Platform Engineer',
    shared: {
      history: [
        {
          message: 'Waiting.',
          occurredAt: createdAt,
          stage: 'queued',
          status: 'running',
        },
        {
          message: 'Waiting complete.',
          occurredAt: createdAt + 1,
          stage: 'queued',
          status: 'completed',
        },
        {
          message: 'Application ready.',
          occurredAt: createdAt + 2,
          stage: 'application',
          status: 'completed',
        },
        {
          message: 'Context captured.',
          occurredAt: createdAt + 3,
          stage: 'capture',
          status: 'completed',
        },
        {
          message: 'Role analyzed.',
          occurredAt: createdAt + 4,
          stage: 'analysis',
          status: 'completed',
        },
        {
          message: 'Evidence planned.',
          occurredAt: createdAt + 5,
          stage: 'evidence',
          status: 'completed',
        },
      ],
      stage: 'evidence',
      status: 'completed',
    },
    status: options.status ?? 'running',
    target: {
      _tag: 'ExistingApplication',
      applicationId: options.applicationId ?? 'application-1',
      factsReleaseId: 'facts-1',
      jobSnapshotId: 'snapshot-1',
      url: 'https://jobs.example.test/platform',
    },
    updatedAt: createdAt + 5,
    url: 'https://jobs.example.test/platform',
  }
}

describe('job-first workflow selectors', () => {
  test('selects authoritative jobs directly without reconstructing artifact runs', () => {
    const first = job('job-1')
    const jobs = new Map([[first.jobId, first]])
    expect(selectPreparationJob(jobs, 'job-1')).toBe(first)
    expect(selectPreparationJob(jobs, 'missing')).toBeNull()
  })

  test('projects shared activity once and branches artifacts after evidence', () => {
    const projection = preparationActivityProjection(
      job('job-1', { withCoverLetter: true })
    )
    expect(
      projection.nodes.filter(({ scope }) => scope === 'shared')
    ).toHaveLength(5)
    expect(
      projection.nodes.find(({ id }) => id === 'cv:composition')?.dependsOn
    ).toEqual(['cv:planning'])
    expect(
      projection.nodes.find(({ id }) => id === 'cv:planning')?.dependsOn
    ).toEqual(['shared:evidence'])
    expect(
      projection.nodes.find(({ id }) => id === 'cover_letter:composition')
        ?.dependsOn
    ).toEqual(['cv:review'])
    expect(
      projection.events.filter(
        ({ scope, stage }) => scope === 'shared' && stage === 'analysis'
      )
    ).toHaveLength(1)
  })

  test('summarizes batches by jobs rather than duplicated artifact counts', () => {
    const jobs = new Map([
      [
        'job-1',
        job('job-1', {
          batchPosition: 0,
          status: 'needs_review',
          withCoverLetter: true,
        }),
      ],
      [
        'job-2',
        job('job-2', {
          applicationId: 'application-2',
          batchPosition: 1,
          createdAt: 20,
          status: 'completed',
        }),
      ],
    ])
    const [batch] = selectPreparationBatches(jobs)
    expect(batch).toMatchObject({
      needsReviewCount: 1,
      status: 'needs_review',
      targetCount: 2,
      terminalCount: 1,
    })
    expect(batch?.kinds).toEqual(['cv', 'cover_letter'])
  })

  test('finds the latest job for an existing application and locale', () => {
    const older = job('job-old', { createdAt: 10 })
    const newer = job('job-new', { createdAt: 20 })
    expect(
      latestApplicationJob(
        new Map([
          [older.jobId, older],
          [newer.jobId, newer],
        ]),
        'application-1',
        'en'
      )
    ).toBe(newer)
  })
})
