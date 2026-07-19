import { describe, expect, test } from 'bun:test'
import type {
  Application,
  ContentEntry,
  ContentRevision,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Queue,
  Ref,
  Stream,
  SubscriptionRef,
} from 'effect'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  cancelPreparation,
  makeSubmitPreparationReview,
  submitPreparationReview,
} from '../commands/review'
import {
  HumanReview,
  type PreparationBootstrap,
  PreparationWorkflowError,
  type PreparationWorkflowInput,
  PrepareApplicationWorkflow,
  ReviewDecisionSchema,
  type SavedCandidate,
} from '../domain'
import { PreparationGateway, type PreparationGatewayService } from '../gateway'
import { PreparationProgress, preparationProgressLayer } from '../progress'
import {
  PreparationConcurrency,
  preparationConcurrencyLayer,
  preparationWorkflowLayer,
} from './handler'

const application: Application = {
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
}

const entry: ContentEntry = {
  applicationId: application.id,
  approvedRevisionId: null,
  createdAt: '2026-07-18T00:00:00.000Z',
  headRevisionId: null,
  id: 'entry-1',
  kind: 'cover_letter',
  locale: 'en',
  state: 'draft',
  updatedAt: '2026-07-18T00:00:00.000Z',
  version: 1,
}

const revision: ContentRevision = {
  byteLength: 42,
  contentEntryId: entry.id,
  contractId: 'cover-letter.v1',
  contractVersion: '1',
  createdAt: '2026-07-18T00:01:00.000Z',
  factsReleaseId: 'facts-release-1',
  id: 'revision-1',
  jobSnapshotId: 'snapshot-1',
  mediaType: 'application/json',
  objectKey: 'objects/revision-1',
  operationId: 'run-1:candidate',
  parentRevisionId: null,
  revisionNumber: 1,
  sha256: 'abc',
  source: 'ai',
}

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

const bootstrap: PreparationBootstrap = {
  application,
  entry,
  factsCatalogue,
  factsReleaseId: 'facts-release-1',
  jobContext: 'Platform role',
  jobSnapshot,
}

const aiMetadata = {
  finishReason: 'stop',
  modelId: 'model-1',
  stage: 'test',
  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
}

const savedCandidate: SavedCandidate = {
  application,
  candidate: {
    _tag: 'CoverLetter',
    document: {
      $schema: 'cover-letter.v1',
      body: 'I build reliable platforms.',
      locale: 'en',
    },
    metadata: [aiMetadata],
  },
  result: {
    entry: { ...entry, headRevisionId: revision.id, version: 2 },
    revision,
  },
}

const input: PreparationWorkflowInput = {
  coverLetterPrompt: null,
  kind: 'cover_letter',
  locale: 'en',
  modelId: 'model-1',
  runId: 'run-1',
  source: {
    _tag: 'ReviewedContext',
    applicationId: application.id,
    factsReleaseId: 'facts-release-1',
    jobSnapshotId: 'snapshot-1',
    url: application.postingUrl,
  },
}

const fakeGateway: PreparationGatewayService = {
  analyze: () =>
    Effect.succeed({
      analysis: {
        company: application.company,
        keywords: ['platform'],
        location: null,
        requirements: [
          { id: 'requirement-1', priority: 'required', text: 'Platforms' },
        ],
        responsibilities: ['Build platforms'],
        role: application.role,
        summary: 'Platform role',
      },
      metadata: { ...aiMetadata, stage: 'analysis' },
    }),
  bootstrap: () => Effect.succeed(bootstrap),
  brief: (_input, _context, _analysis, _plan, sectionId) =>
    Effect.succeed({
      brief: {
        factIds: ['fact-1'],
        notes: ['Use the reviewed platform fact.'],
        objective: 'Show platform experience.',
        sectionId,
      },
      metadata: { ...aiMetadata, stage: `brief:${sectionId}` },
    }),
  compose: () => Effect.succeed(savedCandidate.candidate),
  enrichApplication: () => Effect.succeed(application),
  ensureApplication: () => Effect.succeed(application),
  planEvidence: () =>
    Effect.succeed({
      metadata: { ...aiMetadata, stage: 'evidence' },
      plan: {
        matches: [
          {
            factIds: ['fact-1'],
            rationale: 'Direct platform evidence.',
            requirementId: 'requirement-1',
          },
        ],
        strategy: 'Lead with platform experience.',
        uncoveredRequirementIds: [],
      },
    }),
  saveCandidate: (_input, _context, candidate) =>
    Effect.succeed({ ...savedCandidate, candidate }),
  sectionIds: () => ['profile', 'experience'],
  approveBoundRevision: (_candidate, approvedRevisionId) =>
    Effect.succeed({
      entry: {
        ...savedCandidate.result.entry,
        approvedRevisionId,
        headRevisionId: approvedRevisionId,
        state: 'approved',
      },
      revision,
    }),
  verifyBoundRevision: () => Effect.succeed(savedCandidate.result),
}

const makeTestLayer = (
  gateway: PreparationGatewayService = fakeGateway,
  concurrencyLayer = preparationConcurrencyLayer
) =>
  preparationWorkflowLayer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(PreparationGateway, gateway),
        preparationProgressLayer,
        concurrencyLayer
      )
    ),
    Layer.provideMerge(WorkflowEngine.layerMemory)
  )

describe('in-memory application preparation workflow', () => {
  test('persists a candidate, suspends for review, and resumes on approval', async () => {
    const calls = {
      approve: 0,
      compose: 0,
      ensure: 0,
      save: 0,
    }
    const countedGateway: PreparationGatewayService = {
      ...fakeGateway,
      approveBoundRevision: (candidate, revisionId) =>
        Effect.sync(() => {
          calls.approve += 1
          return fakeGateway.approveBoundRevision(candidate, revisionId)
        }).pipe(Effect.flatten),
      compose: (...args) =>
        Effect.sync(() => {
          calls.compose += 1
          return fakeGateway.compose(...args)
        }).pipe(Effect.flatten),
      ensureApplication: (...args) =>
        Effect.sync(() => {
          calls.ensure += 1
          return fakeGateway.ensureApplication(...args)
        }).pipe(Effect.flatten),
      saveCandidate: (...args) =>
        Effect.sync(() => {
          calls.save += 1
          return fakeGateway.saveCandidate(...args)
        }).pipe(Effect.flatten),
    }
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(input)
        const expectedExecutionId =
          yield* PrepareApplicationWorkflow.executionId(input)
        yield* progress.setExecution(input.runId, expectedExecutionId)

        const awaitingReview = yield* SubscriptionRef.changes(
          progress.runs
        ).pipe(
          Stream.filter(
            (runs) => runs.get(input.runId)?.status === 'awaiting_review'
          ),
          Stream.runHead,
          Effect.forkChild
        )

        const executionId = yield* PrepareApplicationWorkflow.execute(input, {
          discard: true,
        })
        expect(executionId).toBe(expectedExecutionId)
        const observed = yield* Fiber.join(awaitingReview)
        expect(Option.isSome(observed)).toBe(true)
        expect(
          observed.pipe(Option.getOrThrow).get(input.runId)?.candidate
        ).not.toBeNull()

        const token = yield* DurableDeferred.tokenFromPayload(HumanReview, {
          payload: input,
          workflow: PrepareApplicationWorkflow,
        })
        yield* DurableDeferred.succeed(HumanReview, {
          token,
          value: ReviewDecisionSchema.cases.Approved.make({
            revisionId: revision.id,
          }),
        })

        const workflowResult = yield* PrepareApplicationWorkflow.execute(input)
        return {
          run: (yield* SubscriptionRef.get(progress.runs)).get(input.runId),
          workflowResult,
        }
      }).pipe(Effect.provide(makeTestLayer(countedGateway)))
    )

    expect(result.workflowResult).toEqual({
      applicationId: application.id,
      revisionId: revision.id,
      runId: input.runId,
      status: 'approved',
    })
    if (result.run?.status !== 'approved') {
      throw new Error('Expected an approved progress projection.')
    }
    expect(result.run.candidate.result.entry.state).toBe('approved')
    expect(result.run.candidate.result.entry.approvedRevisionId).toBe(
      revision.id
    )
    expect(calls).toEqual({ approve: 1, compose: 1, ensure: 1, save: 1 })
  })

  test('resumes with a rejected result after human review', async () => {
    const rejectedInput = { ...input, runId: 'run-rejected' }
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(rejectedInput)
        yield* progress.setExecution(
          rejectedInput.runId,
          yield* PrepareApplicationWorkflow.executionId(rejectedInput)
        )

        const awaitingReview = yield* SubscriptionRef.changes(
          progress.runs
        ).pipe(
          Stream.filter(
            (runs) =>
              runs.get(rejectedInput.runId)?.status === 'awaiting_review'
          ),
          Stream.runHead,
          Effect.forkChild
        )

        yield* PrepareApplicationWorkflow.execute(rejectedInput, {
          discard: true,
        })
        yield* Fiber.join(awaitingReview)

        const token = yield* DurableDeferred.tokenFromPayload(HumanReview, {
          payload: rejectedInput,
          workflow: PrepareApplicationWorkflow,
        })
        yield* DurableDeferred.succeed(HumanReview, {
          token,
          value: ReviewDecisionSchema.cases.Rejected.make({
            reason: 'Needs stronger evidence.',
          }),
        })

        return yield* PrepareApplicationWorkflow.execute(rejectedInput)
      }).pipe(Effect.provide(makeTestLayer()))
    )

    expect(result).toEqual({
      applicationId: application.id,
      revisionId: null,
      runId: rejectedInput.runId,
      status: 'rejected',
    })
  })

  test('unsafe local cancellation stops a queued run before gateway work', async () => {
    const queuedInput = { ...input, runId: 'run-cancelled' }
    const gate = Effect.runSync(Deferred.make<void>())
    let ensureCalls = 0
    const queuedGateway: PreparationGatewayService = {
      ...fakeGateway,
      ensureApplication: () =>
        Effect.sync(() => {
          ensureCalls += 1
          return application
        }),
    }
    const queuedConcurrencyLayer = Layer.succeed(PreparationConcurrency, {
      withJobSlot: (effect) =>
        Effect.gen(function* () {
          yield* Deferred.await(gate)
          return yield* effect
        }),
    })

    const status = await Effect.runPromise(
      Effect.gen(function* () {
        const engine = yield* WorkflowEngine.WorkflowEngine
        const progress = yield* PreparationProgress
        yield* progress.register(queuedInput)
        const expectedExecutionId =
          yield* PrepareApplicationWorkflow.executionId(queuedInput)
        yield* progress.setExecution(queuedInput.runId, expectedExecutionId)
        const executionId = yield* PrepareApplicationWorkflow.execute(
          queuedInput,
          { discard: true }
        )
        expect(executionId).toBe(expectedExecutionId)

        yield* engine.interruptUnsafe(PrepareApplicationWorkflow, executionId)
        yield* progress.cancel(queuedInput.runId)
        yield* Deferred.succeed(gate, undefined)
        yield* Effect.sleep('20 millis')

        return (yield* SubscriptionRef.get(progress.runs)).get(
          queuedInput.runId
        )?.status
      }).pipe(
        Effect.provide(makeTestLayer(queuedGateway, queuedConcurrencyLayer))
      )
    )

    expect(ensureCalls).toBe(0)
    expect(status).toBe('cancelled')
  })

  test('active cancellation interrupts one in-flight activity without retrying it', async () => {
    const activeInput = { ...input, runId: 'run-active-cancel' }
    const entered = Effect.runSync(Deferred.make<void>())
    let ensureCalls = 0
    const activeGateway: PreparationGatewayService = {
      ...fakeGateway,
      ensureApplication: () =>
        Effect.gen(function* () {
          ensureCalls += 1
          yield* Deferred.succeed(entered, undefined)
          return yield* Effect.never
        }),
    }

    const run = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(activeInput)
        const executionId =
          yield* PrepareApplicationWorkflow.executionId(activeInput)
        yield* progress.setExecution(activeInput.runId, executionId)
        yield* PrepareApplicationWorkflow.execute(activeInput, {
          discard: true,
        })
        yield* Deferred.await(entered)
        yield* cancelPreparation({ executionId, runId: activeInput.runId })
        return (yield* SubscriptionRef.get(progress.runs)).get(
          activeInput.runId
        )
      }).pipe(Effect.provide(makeTestLayer(activeGateway)))
    )

    expect(ensureCalls).toBe(1)
    expect(run?.status).toBe('cancelled')
  })

  test('cancels a workflow suspended at review without unsafe interruption', async () => {
    const suspendedInput = { ...input, runId: 'run-suspended-cancel' }
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(suspendedInput)
        const executionId =
          yield* PrepareApplicationWorkflow.executionId(suspendedInput)
        yield* progress.setExecution(suspendedInput.runId, executionId)
        const awaiting = yield* SubscriptionRef.changes(progress.runs).pipe(
          Stream.filter(
            (runs) =>
              runs.get(suspendedInput.runId)?.status === 'awaiting_review'
          ),
          Stream.runHead,
          Effect.forkChild
        )
        yield* PrepareApplicationWorkflow.execute(suspendedInput, {
          discard: true,
        })
        yield* Fiber.join(awaiting)
        const beforeCancel = (yield* SubscriptionRef.get(progress.runs)).get(
          suspendedInput.runId
        )
        expect(beforeCancel?.status).toBe('awaiting_review')
        expect(beforeCancel?.executionId).toBe(executionId)

        yield* cancelPreparation({
          executionId,
          runId: suspendedInput.runId,
        })
        return {
          run: (yield* SubscriptionRef.get(progress.runs)).get(
            suspendedInput.runId
          ),
        }
      }).pipe(Effect.provide(makeTestLayer()))
    )

    expect(observed.run?.status).toBe('cancelled')
  })

  test('restores review projection when deferred completion defects', async () => {
    const reviewInput = { ...input, runId: 'run-review-defect' }
    const submitWithDefect = makeSubmitPreparationReview(() =>
      Effect.die('deferred store unavailable')
    )
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(reviewInput)
        const executionId =
          yield* PrepareApplicationWorkflow.executionId(reviewInput)
        yield* progress.setExecution(reviewInput.runId, executionId)
        yield* progress.stage(reviewInput.runId, 'review', 'Reviewing')
        const token = DurableDeferred.tokenFromExecutionId(HumanReview, {
          executionId,
          workflow: PrepareApplicationWorkflow,
        })
        yield* progress.reviewReady(
          reviewInput.runId,
          application.id,
          savedCandidate,
          token
        )
        const before = (yield* SubscriptionRef.get(progress.runs)).get(
          reviewInput.runId
        )
        if (before?.status !== 'awaiting_review') {
          return yield* Effect.die('Expected a review-ready workflow run.')
        }

        const exit = yield* Effect.exit(
          submitWithDefect({
            decision: ReviewDecisionSchema.cases.Rejected.make({
              reason: 'Not ready.',
            }),
            runId: reviewInput.runId,
            token: before.reviewToken,
          })
        )
        return {
          before,
          exit,
          run: (yield* SubscriptionRef.get(progress.runs)).get(
            reviewInput.runId
          ),
        }
      }).pipe(Effect.provide(preparationProgressLayer))
    )

    expect(Exit.isFailure(observed.exit)).toBe(true)
    expect(observed.run?.status).toBe('awaiting_review')
    expect(observed.run?.reviewToken).toBe(observed.before.reviewToken)
  })

  test('keeps review unclaimed when authoritative ancestry preflight fails', async () => {
    const reviewInput = { ...input, runId: 'run-review-preflight' }
    let verifyCalls = 0
    const rejectingGateway: PreparationGatewayService = {
      ...fakeGateway,
      verifyBoundRevision: () =>
        Effect.sync(() => {
          verifyCalls += 1
        }).pipe(
          Effect.andThen(
            Effect.fail(
              new PreparationWorkflowError({
                message:
                  'Revision revision-other-ai is not a human edit of the workflow candidate.',
                stage: 'review',
              })
            )
          )
        ),
    }

    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(reviewInput)
        const executionId =
          yield* PrepareApplicationWorkflow.executionId(reviewInput)
        yield* progress.setExecution(reviewInput.runId, executionId)
        yield* progress.stage(reviewInput.runId, 'review', 'Reviewing')
        const token = DurableDeferred.tokenFromExecutionId(HumanReview, {
          executionId,
          workflow: PrepareApplicationWorkflow,
        })
        yield* progress.reviewReady(
          reviewInput.runId,
          application.id,
          savedCandidate,
          token
        )

        const exit = yield* Effect.exit(
          submitPreparationReview({
            decision: ReviewDecisionSchema.cases.Approved.make({
              revisionId: 'revision-human-after-ai',
            }),
            runId: reviewInput.runId,
            token,
          })
        )
        return {
          exit,
          run: (yield* SubscriptionRef.get(progress.runs)).get(
            reviewInput.runId
          ),
          token,
        }
      }).pipe(Effect.provide(makeTestLayer(rejectingGateway)))
    )

    expect(Exit.isFailure(observed.exit)).toBe(true)
    expect(verifyCalls).toBe(1)
    expect(observed.run?.status).toBe('awaiting_review')
    expect(observed.run?.reviewToken).toBe(observed.token)
  })

  test('projects unexpected defects into a failed progress run', async () => {
    const defectiveInput = { ...input, runId: 'run-defect' }
    const defectiveGateway: PreparationGatewayService = {
      ...fakeGateway,
      ensureApplication: () => Effect.die('gateway exploded'),
    }

    const failedRun = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* PreparationProgress
        yield* progress.register(defectiveInput)
        yield* progress.setExecution(
          defectiveInput.runId,
          yield* PrepareApplicationWorkflow.executionId(defectiveInput)
        )
        const failed = yield* SubscriptionRef.changes(progress.runs).pipe(
          Stream.filter(
            (runs) => runs.get(defectiveInput.runId)?.status === 'failed'
          ),
          Stream.runHead,
          Effect.forkChild
        )

        yield* PrepareApplicationWorkflow.execute(defectiveInput, {
          discard: true,
        })
        return (yield* Fiber.join(failed))
          .pipe(Option.getOrThrow)
          .get(defectiveInput.runId)
      }).pipe(Effect.provide(makeTestLayer(defectiveGateway)))
    )

    expect(failedRun?.status).toBe('failed')
    expect(failedRun?.error).toContain('gateway exploded')
  })

  test('limits active preparation jobs, rather than individual activities, to three', async () => {
    const maximum = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const concurrency = yield* PreparationConcurrency
          const active = yield* Ref.make(0)
          const maximum = yield* Ref.make(0)
          const entered = yield* Queue.unbounded<void>()
          const release = yield* Deferred.make<void>()

          const fibers = yield* Effect.forEach(
            [0, 1, 2, 3],
            () =>
              concurrency
                .withJobSlot(
                  Effect.gen(function* () {
                    const count = yield* Ref.updateAndGet(
                      active,
                      (value) => value + 1
                    )
                    yield* Ref.update(maximum, (value) =>
                      Math.max(value, count)
                    )
                    yield* Queue.offer(entered, undefined)
                    yield* Deferred.await(release)
                  }).pipe(
                    Effect.ensuring(Ref.update(active, (value) => value - 1))
                  )
                )
                .pipe(Effect.forkScoped),
            { concurrency: 'unbounded' }
          )

          yield* Queue.take(entered)
          yield* Queue.take(entered)
          yield* Queue.take(entered)
          expect(yield* Ref.get(active)).toBe(3)
          expect(yield* Queue.size(entered)).toBe(0)

          yield* Deferred.succeed(release, undefined)
          yield* Effect.forEach(fibers, Fiber.join, { discard: true })
          return yield* Ref.get(maximum)
        })
      ).pipe(Effect.provide(preparationConcurrencyLayer))
    )

    expect(maximum).toBe(3)
  })
})
