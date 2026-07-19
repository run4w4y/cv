import { describe, expect, test } from 'bun:test'
import type {
  PdfJobResponse,
  SetCvLinkAvailabilityRequest,
} from '@cv/application-registry-api-contract'
import type {
  ContentEntry,
  CvLink,
  GeneratedArtifact,
} from '@cv/application-registry-entity'
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  SubscriptionRef,
} from 'effect'
import { TestClock } from 'effect/testing'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'
import { publicationMutationReactivityKeys } from '../data/keys'
import { PreparationRepository } from '../data/repository'
import {
  PreparationDataError,
  type PreparationRepositoryShape,
} from '../data/types'
import { cancelCvPublication } from './atoms'
import {
  CvPublicationWorkflowError,
  type CvPublicationWorkflowInput,
  PublishCvWorkflow,
} from './domain'
import { CvPublicationProgress, cvPublicationProgressLayer } from './progress'
import { cvPublicationWorkflowLayer } from './workflow'

const recordedAt = '2026-07-18T00:00:00.000Z'

const entry: ContentEntry = {
  applicationId: 'application-1',
  approvedRevisionId: 'revision-1',
  createdAt: recordedAt,
  headRevisionId: 'revision-1',
  id: 'entry-1',
  kind: 'cv',
  locale: 'en',
  state: 'approved',
  updatedAt: recordedAt,
  version: 3,
}

const link: CvLink = {
  applicationId: entry.applicationId,
  contentEntryId: entry.id,
  createdAt: recordedAt,
  disabledAt: null,
  disabledReason: null,
  enabled: true,
  id: 'link-1',
  publicationVersion: 2,
  publishedRevisionId: 'revision-1',
  publicUrl: 'https://cv.example.test/public/link-1',
  token: 'public-token',
  updatedAt: recordedAt,
  version: 2,
}

const artifact: GeneratedArtifact = {
  byteLength: 1_024,
  contentRevisionId: 'revision-1',
  createdAt: recordedAt,
  cvLinkId: link.id,
  errorCode: null,
  errorMessage: null,
  generatedAt: recordedAt,
  id: 'artifact-1',
  kind: 'pdf',
  mediaType: 'application/pdf',
  objectKey: 'artifacts/artifact-1.pdf',
  publicationVersion: link.publicationVersion,
  qrTarget: link.publicUrl,
  rendererVersion: 'renderer-v1',
  sha256: 'abc123',
  status: 'ready',
  updatedAt: recordedAt,
  requestId: 'pdf-request-1',
}

const runningPdf: PdfJobResponse = {
  errorCode: null,
  errorMessage: null,
  jobId: artifact.id,
  status: 'pending',
}

const completePdf: PdfJobResponse = {
  errorCode: null,
  errorMessage: null,
  jobId: artifact.id,
  status: 'ready',
}

const input: CvPublicationWorkflowInput = {
  applicationId: entry.applicationId,
  entry,
  publicBaseUrl: 'https://cv.example.test',
  rendererVersion: artifact.rendererVersion,
  runId: 'publication-run-1',
}

const unimplemented = <A>(): Effect.Effect<A, PreparationDataError> =>
  Effect.die('Repository operation is not used by this publication test.')

const makeRepository = (
  overrides: Partial<PreparationRepositoryShape>
): PreparationRepositoryShape => ({
  appendRevision: () => unimplemented(),
  approveRevision: () => unimplemented(),
  discoverModels: () => unimplemented(),
  loadBootstrap: () => unimplemented(),
  loadContentHead: () => unimplemented(),
  loadContext: () => unimplemented(),
  loadPreparationHead: () => unimplemented(),
  loadPublishedCvState: () => unimplemented(),
  persistManualJobContext: () => unimplemented(),
  publishCv: () => unimplemented(),
  readCurrentPdf: () => unimplemented(),
  readPdfJob: () => unimplemented(),
  refreshSnapshot: () => unimplemented(),
  setPublicationAvailability: () => unimplemented(),
  startPdfGeneration: () => unimplemented(),
  ...overrides,
})

const testLayer = (repository: PreparationRepositoryShape) =>
  cvPublicationWorkflowLayer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(PreparationRepository, repository),
        cvPublicationProgressLayer,
        Reactivity.layer
      )
    ),
    Layer.provideMerge(WorkflowEngine.layerMemory)
  )

describe('session CV publication Workflow', () => {
  test('polls with Schedule/TestClock and verifies the current artifact', async () => {
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const firstPoll = yield* Deferred.make<void>()
        let pollReads = 0
        const repository = makeRepository({
          loadPublishedCvState: () => Effect.succeed({ artifact, link }),
          publishCv: () => Effect.succeed(link),
          readPdfJob: () =>
            Effect.sync(() => {
              pollReads += 1
              return pollReads === 1 ? runningPdf : completePdf
            }).pipe(
              Effect.tap(() =>
                pollReads === 1
                  ? Deferred.succeed(firstPoll, undefined)
                  : Effect.void
              )
            ),
          startPdfGeneration: () => Effect.succeed(runningPdf),
        })

        return yield* Effect.gen(function* () {
          const progress = yield* CvPublicationProgress
          const executionId = yield* PublishCvWorkflow.executionId(input)
          yield* progress.reserve(input, executionId)
          const execution = yield* PublishCvWorkflow.execute(input).pipe(
            Effect.forkChild
          )

          yield* Deferred.await(firstPoll)
          yield* Effect.yieldNow
          expect(
            (yield* SubscriptionRef.get(progress.runs)).get(input.runId)?._tag
          ).toBe('PollingPdf')

          yield* TestClock.adjust('2 seconds')
          const result = yield* Fiber.join(execution)
          return {
            pollReads,
            result,
            run: (yield* SubscriptionRef.get(progress.runs)).get(input.runId),
          }
        }).pipe(Effect.provide(testLayer(repository)))
      }).pipe(Effect.provide(TestClock.layer()))
    )

    expect(observed.pollReads).toBe(2)
    expect(observed.result.artifact.id).toBe(artifact.id)
    expect(observed.result.link.id).toBe(link.id)
    expect(observed.run?._tag).toBe('Published')
  })

  test('retries a transient PDF job read with a bounded Schedule', async () => {
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const firstReadFailed = yield* Deferred.make<void>()
        let pollReads = 0
        const repository = makeRepository({
          loadPublishedCvState: () => Effect.succeed({ artifact, link }),
          publishCv: () => Effect.succeed(link),
          readPdfJob: () =>
            Effect.suspend(() => {
              pollReads += 1
              if (pollReads === 1) {
                return Deferred.succeed(firstReadFailed, undefined).pipe(
                  Effect.andThen(
                    Effect.fail(
                      new PreparationDataError({
                        message: 'The PDF job read timed out.',
                        operation: 'read-pdf-job',
                      })
                    )
                  )
                )
              }
              return Effect.succeed(completePdf)
            }),
          startPdfGeneration: () => Effect.succeed(runningPdf),
        })

        return yield* Effect.gen(function* () {
          const progress = yield* CvPublicationProgress
          const executionId = yield* PublishCvWorkflow.executionId(input)
          yield* progress.reserve(input, executionId)
          const execution = yield* PublishCvWorkflow.execute(input).pipe(
            Effect.forkChild
          )

          yield* Deferred.await(firstReadFailed)
          yield* TestClock.adjust('1 second')
          const result = yield* Fiber.join(execution)
          return {
            pollReads,
            result,
            run: (yield* SubscriptionRef.get(progress.runs)).get(input.runId),
          }
        }).pipe(Effect.provide(testLayer(repository)))
      }).pipe(Effect.provide(TestClock.layer()))
    )

    expect(observed.pollReads).toBe(2)
    expect(observed.result.artifact.id).toBe(artifact.id)
    expect(observed.run?._tag).toBe('Published')
  })

  test('does not retry an ambiguous publish response and invalidates authoritative state', async () => {
    let publishCalls = 0
    let pdfStarts = 0
    const repository = makeRepository({
      publishCv: () =>
        Effect.sync(() => {
          publishCalls += 1
        }).pipe(
          Effect.andThen(
            Effect.fail(
              new PreparationDataError({
                message: 'The publish response was lost.',
                operation: 'publish-cv',
              })
            )
          )
        ),
      startPdfGeneration: () =>
        Effect.sync(() => {
          pdfStarts += 1
          return runningPdf
        }),
    })

    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* CvPublicationProgress
        const reactivity = yield* Reactivity.Reactivity
        const keys = publicationMutationReactivityKeys(
          input.applicationId,
          input.entry.id
        )
        const invalidations = keys.map(() => 0)
        const unregister = keys.map((key, index) =>
          reactivity.registerUnsafe([key], () => {
            invalidations[index] = (invalidations[index] ?? 0) + 1
          })
        )
        const executionId = yield* PublishCvWorkflow.executionId(input)
        yield* progress.reserve(input, executionId)
        const exit = yield* Effect.exit(PublishCvWorkflow.execute(input))
        unregister.forEach((cancel) => {
          cancel()
        })
        return {
          exit,
          invalidations,
          run: (yield* SubscriptionRef.get(progress.runs)).get(input.runId),
        }
      }).pipe(Effect.provide(testLayer(repository)))
    )

    expect(publishCalls).toBe(1)
    expect(pdfStarts).toBe(0)
    expect(observed.invalidations).toEqual([1, 1, 1])
    expect(Exit.isFailure(observed.exit)).toBe(true)
    expect(observed.run?._tag).toBe('Failed')
    if (observed.run?._tag !== 'Failed') throw new Error('Expected failure.')
    expect(observed.run.error.stage).toBe('publish-link')
  })

  test('disables the new link when PDF startup fails', async () => {
    let availability: SetCvLinkAvailabilityRequest | undefined
    const disabledLink = {
      ...link,
      disabledAt: recordedAt,
      disabledReason: 'PDF generation could not be started.',
      enabled: false,
      version: link.version + 1,
    }
    const repository = makeRepository({
      publishCv: () => Effect.succeed(link),
      setPublicationAvailability: ({ input: requested }) =>
        Effect.sync(() => {
          availability = requested
          return disabledLink
        }),
      startPdfGeneration: () =>
        Effect.fail(
          new PreparationDataError({
            message: 'PDF worker is unavailable.',
            operation: 'start-pdf-generation',
          })
        ),
    })

    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const progress = yield* CvPublicationProgress
        const executionId = yield* PublishCvWorkflow.executionId(input)
        yield* progress.reserve(input, executionId)
        const exit = yield* Effect.exit(PublishCvWorkflow.execute(input))
        return {
          exit,
          run: (yield* SubscriptionRef.get(progress.runs)).get(input.runId),
        }
      }).pipe(Effect.provide(testLayer(repository)))
    )

    expect(availability).toEqual({
      enabled: false,
      expectedPublicationVersion: link.publicationVersion,
      reason: 'PDF generation could not be started.',
    })
    expect(Exit.isFailure(observed.exit)).toBe(true)
    if (Exit.isSuccess(observed.exit)) throw new Error('Expected failure.')
    const error = Cause.findErrorOption(observed.exit.cause)
    expect(Option.isSome(error)).toBe(true)
    if (Option.isNone(error)) throw new Error('Expected typed failure.')
    expect(error.value).toBeInstanceOf(CvPublicationWorkflowError)
    expect(error.value.stage).toBe('start-pdf')
    expect(observed.run?._tag).toBe('Failed')
  })

  test('cancels an active session workflow immediately', async () => {
    const cancelledInput = { ...input, runId: 'publication-run-cancelled' }
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const publishing = yield* Deferred.make<void>()
        const neverPublish = yield* Deferred.make<void>()
        const repository = makeRepository({
          publishCv: () =>
            Effect.gen(function* () {
              yield* Deferred.succeed(publishing, undefined)
              yield* Deferred.await(neverPublish)
              return link
            }),
        })

        return yield* Effect.gen(function* () {
          const progress = yield* CvPublicationProgress
          const reactivity = yield* Reactivity.Reactivity
          const keys = publicationMutationReactivityKeys(
            cancelledInput.applicationId,
            cancelledInput.entry.id
          )
          const invalidations = keys.map(() => 0)
          const unregister = keys.map((key, index) =>
            reactivity.registerUnsafe([key], () => {
              invalidations[index] = (invalidations[index] ?? 0) + 1
            })
          )
          const executionId =
            yield* PublishCvWorkflow.executionId(cancelledInput)
          yield* progress.reserve(cancelledInput, executionId)
          yield* PublishCvWorkflow.execute(cancelledInput, { discard: true })
          yield* Deferred.await(publishing)
          yield* cancelCvPublication({
            executionId,
            runId: cancelledInput.runId,
          })
          unregister.forEach((cancel) => {
            cancel()
          })
          return {
            invalidations,
            run: (yield* SubscriptionRef.get(progress.runs)).get(
              cancelledInput.runId
            ),
          }
        }).pipe(Effect.provide(testLayer(repository)))
      })
    )

    expect(observed.run?._tag).toBe('Cancelled')
    expect(observed.invalidations).toEqual([1, 1, 1])
  })
})
