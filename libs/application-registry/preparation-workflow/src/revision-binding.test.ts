import { describe, expect, test } from 'bun:test'
import type {
  ContentEntry,
  ContentRevision,
} from '@cv/application-registry-entity'

import type {
  ContentRevisionResult,
  PreparationRun,
  SavedCandidate,
} from './domain'
import { isRevisionBoundToPreparationRun } from './revision-binding'

const entry: ContentEntry = {
  applicationId: 'application-1',
  approvedRevisionId: null,
  createdAt: '2026-07-18T00:00:00.000Z',
  headRevisionId: 'revision-ai',
  id: 'entry-1',
  kind: 'cv',
  locale: 'en',
  state: 'draft',
  updatedAt: '2026-07-18T00:00:00.000Z',
  version: 2,
}

const revision: ContentRevision = {
  byteLength: 42,
  contentEntryId: entry.id,
  contractId: 'cv.document.v1',
  contractVersion: '1',
  createdAt: '2026-07-18T00:01:00.000Z',
  factsReleaseId: 'facts-release-1',
  id: 'revision-ai',
  jobSnapshotId: 'snapshot-1',
  mediaType: 'application/json',
  objectKey: 'objects/revision-ai',
  operationId: 'run-1:candidate',
  parentRevisionId: null,
  revisionNumber: 1,
  sha256: 'abc',
  source: 'ai',
}

const result: ContentRevisionResult = { entry, revision }

const candidate: SavedCandidate = {
  application: {
    applicationStatus: 'preparing',
    appliedAt: null,
    postingUrl: 'https://jobs.example.test/role',
    company: 'Example',
    createdAt: '2026-07-18T00:00:00.000Z',
    followUpAt: null,
    id: 'application-1',
    listingAvailability: 'open',
    listingCheckedAt: null,
    listingClosedCandidateAt: null,
    listingConfidence: null,
    listingConsecutiveClosedChecks: 0,
    listingReasonCode: null,
    location: null,
    personalPriority: null,
    role: 'Platform Engineer',
    targetStage: 'backlog',
    updatedAt: '2026-07-18T00:00:00.000Z',
    updatedRevision: 1,
    version: 1,
  },
  candidate: {
    _tag: 'Cv',
    document: {
      $schema: 'cv.document.v1',
      additionalSections: [],
      direction: 'ltr',
      education: [],
      experience: [],
      locale: 'en',
      person: {
        contacts: [],
        headline: 'Platform engineer',
        name: 'Ada Example',
        summary: 'Builds reliable systems.',
      },
      projects: [],
      skills: [],
    },
    metadata: [],
  },
  result,
}

const run: PreparationRun = {
  applicationId: 'application-1',
  batchId: 'batch-1',
  batchPosition: 0,
  candidate,
  createdAt: 1,
  error: null,
  kind: 'cv',
  locale: 'en',
  message: 'Review',
  runId: 'run-1',
  stage: 'review',
  status: 'review_submitted',
  stepHistory: [],
  updatedAt: 2,
  url: 'https://jobs.example.test/role',
}

describe('workflow review binding', () => {
  test('accepts the generated candidate and human revisions with identical pins', () => {
    expect(isRevisionBoundToPreparationRun(run, result)).toBe(true)
    expect(
      isRevisionBoundToPreparationRun(run, {
        entry: { ...entry, headRevisionId: 'revision-human', version: 3 },
        revision: {
          ...revision,
          id: 'revision-human',
          parentRevisionId: revision.id,
          source: 'human',
        },
      })
    ).toBe(true)
  })

  test('rejects unrelated revisions and changed provenance pins', () => {
    expect(
      isRevisionBoundToPreparationRun(run, {
        entry,
        revision: { ...revision, id: 'revision-other' },
      })
    ).toBe(false)
    expect(
      isRevisionBoundToPreparationRun(run, {
        entry,
        revision: {
          ...revision,
          factsReleaseId: 'facts-release-other',
          id: 'revision-human',
          source: 'human',
        },
      })
    ).toBe(false)
  })
})
