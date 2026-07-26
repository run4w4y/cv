import { describe, expect, test } from 'bun:test'
import type {
  ContentEntry,
  ContentRevision,
} from '@cv/application-registry-entity'

import type {
  ContentRevisionResult,
  PreparationArtifact,
  SavedCandidate,
} from './domain'
import { isRevisionBoundToPreparationArtifact } from './revision-binding'

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

const artifact: PreparationArtifact = {
  candidate,
  error: null,
  history: [],
  kind: 'cv',
  message: 'Review',
  stage: 'review',
  status: 'review_submitted',
  updatedAt: 2,
}

describe('workflow review binding', () => {
  test('accepts the candidate, human edits, and run-bound Codex refinements with identical pins', () => {
    expect(isRevisionBoundToPreparationArtifact(artifact, result)).toBe(true)
    expect(
      isRevisionBoundToPreparationArtifact(artifact, {
        entry: { ...entry, headRevisionId: 'revision-human', version: 3 },
        revision: {
          ...revision,
          id: 'revision-human',
          parentRevisionId: revision.id,
          source: 'human',
        },
      })
    ).toBe(true)
    expect(
      isRevisionBoundToPreparationArtifact(artifact, {
        entry: { ...entry, headRevisionId: 'revision-refined', version: 3 },
        revision: {
          ...revision,
          id: 'revision-refined',
          operationId: 'run-1:refinement:request-1',
          parentRevisionId: revision.id,
          source: 'ai_adjustment',
        },
      })
    ).toBe(true)
  })

  test('rejects unrelated revisions and changed provenance pins', () => {
    expect(
      isRevisionBoundToPreparationArtifact(artifact, {
        entry,
        revision: { ...revision, id: 'revision-other' },
      })
    ).toBe(false)
    expect(
      isRevisionBoundToPreparationArtifact(artifact, {
        entry,
        revision: {
          ...revision,
          factsReleaseId: 'facts-release-other',
          id: 'revision-human',
          source: 'human',
        },
      })
    ).toBe(false)
    expect(
      isRevisionBoundToPreparationArtifact(artifact, {
        entry,
        revision: {
          ...revision,
          id: 'revision-refined',
          operationId: 'other-run:refinement:request-1',
          source: 'ai_adjustment',
        },
      })
    ).toBe(false)
  })
})
