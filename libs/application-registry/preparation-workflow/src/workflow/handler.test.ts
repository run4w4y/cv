import { describe, expect, test } from 'bun:test'
import type {
  Application,
  ContentEntry,
  ContentRevision,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect, Fiber, Layer, Option, Stream, SubscriptionRef } from 'effect'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  type PreparationBootstrap,
  type PreparationJobInput,
  PrepareApplicationWorkflow,
  preparationApprovalDeferred,
  type SavedCandidate,
} from '../domain'
import { PreparationGateway, type PreparationGatewayService } from '../gateway'
import { PreparationProgress, preparationProgressLayer } from '../progress'
import { cvGenerationGuidanceTestFixture } from '../test-support'
import {
  preparationConcurrencyLayer,
  preparationWorkflowLayer,
} from './handler'

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  postingUrl: 'https://jobs.example.test/platform',
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
}

const entry = (kind: ContentEntry['kind'], id: string): ContentEntry => ({
  applicationId: application.id,
  approvedRevisionId: null,
  createdAt: '2026-07-18T00:00:00.000Z',
  headRevisionId: null,
  id,
  kind,
  locale: 'en',
  state: 'draft',
  updatedAt: '2026-07-18T00:00:00.000Z',
  version: 1,
})

const cvEntry = entry('cv', 'entry-cv')
const letterEntry = entry('cover_letter', 'entry-letter')

const revision = (
  contentEntry: ContentEntry,
  id: string,
  operationId: string,
  source: ContentRevision['source'] = 'ai'
): ContentRevision => ({
  byteLength: 42,
  contentEntryId: contentEntry.id,
  contractId: contentEntry.kind === 'cv' ? 'cv.document.v1' : 'cover-letter.v1',
  contractVersion: '1',
  createdAt: '2026-07-18T00:01:00.000Z',
  factsReleaseId: 'facts-release-1',
  id,
  jobSnapshotId: 'snapshot-1',
  mediaType: 'application/json',
  objectKey: `objects/${id}`,
  operationId,
  parentRevisionId: null,
  revisionNumber: 1,
  sha256: id,
  source,
})

const cvRevision = revision(cvEntry, 'revision-cv', 'job-1:cv:candidate')
const acceptedCvRevision = {
  ...cvRevision,
  id: 'revision-cv-accepted',
  objectKey: 'objects/revision-cv-accepted',
  operationId: 'job-1:cv:refinement:accepted',
  parentRevisionId: cvRevision.id,
  revisionNumber: 2,
  source: 'ai_adjustment' as const,
}
const letterRevision = revision(
  letterEntry,
  'revision-letter',
  'job-1:cover-letter:candidate'
)

const jobSnapshot: JobPostingSnapshot = {
  applicationId: application.id,
  errorCode: null,
  errorMessage: null,
  fetchedAt: '2026-07-18T00:00:00.000Z',
  fetcherVersion: 'test/v1',
  finalUrl: application.postingUrl,
  id: 'snapshot-1',
  normalizedByteLength: 12,
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

const factsCatalogue: FactsCatalogueV1 = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [{ id: 'fact-1', text: 'Built reliable platforms.' }],
      kind: 'identity',
      languages: [],
      name: 'Ada Example',
    },
  ],
}

const generatedCv: Extract<
  SavedCandidate['candidate'],
  { readonly _tag: 'Cv' }
>['document'] = {
  $schema: 'cv.document.v1',
  additionalSections: [],
  direction: 'ltr',
  education: [],
  experience: [],
  locale: 'en',
  person: {
    contacts: [
      {
        href: 'mailto:ada@example.test',
        kind: 'email',
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

const acceptedCv = {
  ...generatedCv,
  person: {
    ...generatedCv.person,
    headline: 'Principal platform engineer',
  },
}

const generationMetadata = {
  executor: 'codex-local',
  stage: 'test',
  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
}

const bootstrap = (
  contentEntry: ContentEntry,
  referenceCvRevisionId: string | null = null
): PreparationBootstrap => ({
  application,
  cvGenerationGuidance: cvGenerationGuidanceTestFixture,
  entry: contentEntry,
  factsCatalogue,
  factsReleaseId: 'facts-release-1',
  jobContext: 'Platform role',
  jobSnapshot,
  referenceCv: referenceCvRevisionId === null ? null : acceptedCv,
  referenceCvRevisionId,
})

const input: PreparationJobInput = {
  artifacts: {
    coverLetter: { prompt: 'Keep it concise.' },
    cv: { generationGuidance: cvGenerationGuidanceTestFixture },
  },
  jobId: 'job-1',
  locale: 'en',
  target: {
    _tag: 'PostingUrl',
    url: application.postingUrl,
  },
}

const makeLayer = (gateway: PreparationGatewayService) =>
  preparationWorkflowLayer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(PreparationGateway, gateway),
        preparationProgressLayer,
        preparationConcurrencyLayer
      )
    ),
    Layer.provideMerge(WorkflowEngine.layerMemory)
  )

describe('job-first preparation workflow', () => {
  test('waits for the accepted CV and binds the cover letter to that exact revision', async () => {
    const calls = {
      analysis: 0,
      coverCompositions: 0,
      cvCompositions: 0,
    }
    const observedReference = {
      document: null as typeof acceptedCv | null,
      revisionId: null as string | null,
    }
    const gateway: PreparationGatewayService = {
      analyze: () =>
        Effect.sync(() => {
          calls.analysis += 1
          return {
            analysis: {
              company: application.company,
              educationDatesRequired: false,
              keywords: ['platform'],
              location: null,
              requirements: [
                {
                  id: 'requirement-1',
                  priority: 'required' as const,
                  text: 'Platforms',
                },
              ],
              responsibilities: ['Build platforms'],
              role: application.role,
              summary: 'Platform role',
            },
            metadata: { ...generationMetadata, stage: 'analysis' },
          }
        }),
      bootstrap: (artifactInput) =>
        Effect.succeed(
          artifactInput.kind === 'cv'
            ? bootstrap(cvEntry)
            : bootstrap(letterEntry, acceptedCvRevision.id)
        ),
      composeCoverLetter: (_artifactInput, context) =>
        Effect.sync(() => {
          calls.coverCompositions += 1
          observedReference.document = context.referenceCv
          observedReference.revisionId = context.referenceCvRevisionId
          return {
            _tag: 'CoverLetter' as const,
            document: {
              $schema: 'cover-letter.v1' as const,
              body: 'I build reliable platforms.',
              locale: 'en',
              referenceCvRevisionId: context.referenceCvRevisionId ?? 'missing',
            },
            metadata: [generationMetadata],
          }
        }),
      composeCv: () =>
        Effect.sync(() => {
          calls.cvCompositions += 1
          return {
            _tag: 'Cv' as const,
            document: generatedCv,
            metadata: [generationMetadata],
          }
        }),
      enrichApplication: () => Effect.succeed(application),
      ensureApplication: () => Effect.succeed(application),
      planEvidence: () =>
        Effect.succeed({
          metadata: { ...generationMetadata, stage: 'evidence' },
          plan: {
            requirements: [
              {
                evidenceIds: ['fact-1'],
                requirementId: 'requirement-1',
              },
            ],
          },
        }),
      planCv: () =>
        Effect.succeed({
          metadata: { ...generationMetadata, stage: 'planning' },
          plan: {
            additionalEvidenceIds: [],
            education: [],
            experience: [],
            profileEvidenceIds: [],
            projects: [],
            skillGroups: [],
          },
        }),
      saveCandidate: (artifactInput, _context, candidate) =>
        Effect.succeed({
          application,
          candidate,
          result:
            artifactInput.kind === 'cv'
              ? {
                  entry: {
                    ...cvEntry,
                    headRevisionId: cvRevision.id,
                    version: 2,
                  },
                  revision: cvRevision,
                }
              : {
                  entry: {
                    ...letterEntry,
                    headRevisionId: letterRevision.id,
                    version: 2,
                  },
                  revision: letterRevision,
                },
        }),
      approveBoundRevision: (candidate, selectedRevisionId) =>
        Effect.succeed(
          candidate.candidate._tag === 'Cv'
            ? {
                entry: {
                  ...candidate.result.entry,
                  approvedRevisionId: selectedRevisionId,
                  headRevisionId: selectedRevisionId,
                  state: 'approved',
                },
                revision: acceptedCvRevision,
              }
            : {
                entry: {
                  ...candidate.result.entry,
                  approvedRevisionId: selectedRevisionId,
                  headRevisionId: selectedRevisionId,
                  state: 'approved',
                },
                revision: letterRevision,
              }
        ),
      verifyBoundRevision: (candidate) => Effect.succeed(candidate.result),
    }

    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.reserve([
          {
            batchId: 'batch-1',
            batchPosition: 0,
            input,
            retryOfJobId: null,
          },
        ])
        const executionId = yield* PrepareApplicationWorkflow.executionId(input)
        yield* progress.setExecution(input.jobId, executionId)

        const cvReady = yield* SubscriptionRef.changes(progress.jobs).pipe(
          Stream.filter(
            (jobs) =>
              jobs.get(input.jobId)?.artifacts.cv?.status === 'awaiting_review'
          ),
          Stream.runHead,
          Effect.forkChild
        )
        yield* PrepareApplicationWorkflow.execute(input, { discard: true })
        const cvProjection = yield* Fiber.join(cvReady).pipe(
          Effect.timeoutOption('1 second')
        )
        expect(Option.isSome(cvProjection)).toBe(true)
        expect(calls.coverCompositions).toBe(0)

        const letterReady = yield* SubscriptionRef.changes(progress.jobs).pipe(
          Stream.filter(
            (jobs) =>
              jobs.get(input.jobId)?.artifacts.coverLetter?.status ===
              'awaiting_review'
          ),
          Stream.runHead,
          Effect.forkChild
        )
        const cvApproval = preparationApprovalDeferred('cv')
        const cvToken = yield* DurableDeferred.tokenFromPayload(cvApproval, {
          payload: input,
          workflow: PrepareApplicationWorkflow,
        })
        yield* DurableDeferred.succeed(cvApproval, {
          token: cvToken,
          value: { revisionId: acceptedCvRevision.id },
        })
        const letterProjection = yield* Fiber.join(letterReady).pipe(
          Effect.timeoutOption('1 second')
        )
        expect(Option.isSome(letterProjection)).toBe(true)

        const letterApproval = preparationApprovalDeferred('cover_letter')
        const letterToken = yield* DurableDeferred.tokenFromPayload(
          letterApproval,
          {
            payload: input,
            workflow: PrepareApplicationWorkflow,
          }
        )
        yield* DurableDeferred.succeed(letterApproval, {
          token: letterToken,
          value: { revisionId: letterRevision.id },
        })
        return yield* PrepareApplicationWorkflow.execute(input)
      }).pipe(Effect.provide(makeLayer(gateway)))
    )

    expect(calls).toEqual({
      analysis: 1,
      coverCompositions: 1,
      cvCompositions: 1,
    })
    expect(observedReference).toEqual({
      document: acceptedCv,
      revisionId: acceptedCvRevision.id,
    })
    expect(observed).toMatchObject({
      applicationId: application.id,
      artifacts: [
        {
          kind: 'cv',
          revisionId: acceptedCvRevision.id,
          status: 'approved',
        },
        {
          kind: 'cover_letter',
          revisionId: letterRevision.id,
          status: 'approved',
        },
      ],
      jobId: input.jobId,
      status: 'completed',
    })
  })
})
