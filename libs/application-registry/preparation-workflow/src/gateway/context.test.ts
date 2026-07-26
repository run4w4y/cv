import { describe, expect, test } from 'bun:test'
import type {
  Application,
  ContentEntry,
  ContentRevision,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import type { PreparationWorkflowInput } from '../domain'
import { PreparationStore } from '../store'
import {
  cvGenerationGuidanceTestFixture,
  makePreparationStoreTestLayer,
} from '../test-support'
import { makePreparationContextGateway } from './context'

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  company: 'Example',
  createdAt: '2026-07-23T00:00:00.000Z',
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
  postingUrl: 'https://jobs.example.test/platform',
  role: 'Platform Engineer',
  targetStage: 'backlog',
  updatedAt: '2026-07-23T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const coverLetterEntry: ContentEntry = {
  applicationId: application.id,
  approvedRevisionId: null,
  createdAt: application.createdAt,
  headRevisionId: null,
  id: 'cover-letter-entry-1',
  kind: 'cover_letter',
  locale: 'en',
  state: 'draft',
  updatedAt: application.updatedAt,
  version: 1,
}

const cvEntry: ContentEntry = {
  ...coverLetterEntry,
  approvedRevisionId: 'cv-revision-1',
  headRevisionId: 'cv-revision-1',
  id: 'cv-entry-1',
  kind: 'cv',
  state: 'approved',
}

const cvRevision: ContentRevision = {
  byteLength: 100,
  contentEntryId: cvEntry.id,
  contractId: 'cv.document.v1',
  contractVersion: '1',
  createdAt: application.createdAt,
  factsReleaseId: 'facts-release-1',
  id: 'cv-revision-1',
  jobSnapshotId: 'snapshot-1',
  mediaType: 'application/json',
  objectKey: 'objects/cv-revision-1',
  operationId: 'job-1:cv:candidate',
  parentRevisionId: null,
  revisionNumber: 1,
  sha256: 'cv',
  source: 'ai',
}

const cvDocument = {
  $schema: 'cv.document.v1' as const,
  additionalSections: [],
  direction: 'ltr' as const,
  education: [],
  experience: [],
  locale: 'en',
  person: {
    contacts: [
      {
        href: 'mailto:ada@example.test',
        kind: 'email' as const,
        label: 'Email',
        value: 'ada@example.test',
      },
    ],
    headline: 'Platform engineer',
    name: 'Ada Example',
    summary: 'Builds reliable platforms.',
  },
  projects: [],
  skills: [],
}

const factsCatalogue: FactsCatalogueV1 = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [],
      kind: 'identity',
      languages: [],
      name: 'Ada Example',
    },
  ],
}

const jobSnapshot: JobPostingSnapshot = {
  applicationId: application.id,
  errorCode: null,
  errorMessage: null,
  fetchedAt: application.createdAt,
  fetcherVersion: 'test/v1',
  finalUrl: application.postingUrl,
  id: 'snapshot-1',
  normalizedByteLength: 20,
  normalizedMediaType: 'text/plain',
  normalizedObjectKey: 'objects/snapshot-1',
  normalizedSha256: 'abc',
  rawByteLength: null,
  rawMediaType: null,
  rawObjectKey: null,
  rawSha256: null,
  requestedUrl: application.postingUrl,
  status: 'fetched',
}

const input: PreparationWorkflowInput = {
  kind: 'cover_letter',
  locale: 'en',
  prompt: 'Keep it concise.',
  runId: 'cover-letter-run-1',
  source: {
    _tag: 'CaptureUrl',
    url: application.postingUrl,
  },
}

describe('preparation context gateway', () => {
  test('loads the exact approved CV revision for cover-letter alignment', async () => {
    let loadedSnapshotId: string | null | undefined
    let headLoads = 0
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* PreparationStore
        return yield* makePreparationContextGateway(store).bootstrap(
          input,
          application
        )
      }).pipe(
        Effect.provide(
          makePreparationStoreTestLayer({
            loadPreparationHead: () => {
              headLoads += 1
              return Effect.succeed({
                entry: cvEntry,
                revision: cvRevision,
                value: cvDocument,
              })
            },
            loadWorkflowBootstrap: (request) => {
              loadedSnapshotId = request.snapshotId
              return Effect.succeed({
                context: {
                  cvGenerationGuidance: cvGenerationGuidanceTestFixture,
                  factsCatalogue,
                  factsReleaseId: 'facts-release-1',
                  jobContext: 'Platform role',
                  jobSnapshot,
                },
                entry: coverLetterEntry,
              })
            },
          })
        )
      )
    )

    expect(headLoads).toBe(1)
    expect(loadedSnapshotId).toBeNull()
    expect(result.jobSnapshot.id).toBe('snapshot-1')
    expect(result.referenceCvRevisionId).toBe(cvRevision.id)
    expect(result.referenceCv).toEqual(cvDocument)
  })

  test('rejects drift from a pinned reviewed facts release', async () => {
    const reviewedInput: PreparationWorkflowInput = {
      ...input,
      source: {
        _tag: 'ReviewedContext',
        applicationId: application.id,
        factsReleaseId: 'facts-release-1',
        jobSnapshotId: jobSnapshot.id,
        url: application.postingUrl,
      },
    }
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* PreparationStore
        return yield* Effect.flip(
          makePreparationContextGateway(store).bootstrap(
            reviewedInput,
            application
          )
        )
      }).pipe(
        Effect.provide(
          makePreparationStoreTestLayer({
            loadWorkflowBootstrap: () =>
              Effect.succeed({
                context: {
                  cvGenerationGuidance: cvGenerationGuidanceTestFixture,
                  factsCatalogue,
                  factsReleaseId: 'facts-release-2',
                  jobContext: 'Platform role',
                  jobSnapshot,
                },
                entry: coverLetterEntry,
              }),
          })
        )
      )
    )

    expect(error.stage).toBe('facts')
    expect(error.message).toContain('is no longer active')
  })
})
