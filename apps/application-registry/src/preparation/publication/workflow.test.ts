import { describe, expect, test } from 'bun:test'
import type {
  PdfJobResponse,
  SetCvLinkAvailabilityRequest,
} from '@cv/application-registry-api-contract'
import {
  type ContentEntry,
  type CvLink,
  pdfGenerationFailedDisableReason,
} from '@cv/application-registry-entity'
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Layer,
  Option,
  SubscriptionRef,
} from 'effect'
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
  currentRevisionId: 'revision-1',
  disabledAt: null,
  disabledReason: null,
  enabled: true,
  id: 'link-1',
  previewToken: 'preview-token',
  publicationVersion: 2,
  publicUrl: 'https://cv.example.test/c/public-token',
  token: 'public-token',
  updatedAt: recordedAt,
  version: 2,
}

const runningPdf: PdfJobResponse = {
  errorCode: null,
  errorMessage: null,
  jobId: 'artifact-1',
  status: 'pending',
}

const input: CvPublicationWorkflowInput = {
  applicationId: entry.applicationId,
  entry,
  expectedPublicationVersion: link.publicationVersion,
  runId: 'publication-run-1',
}

const unimplemented = <A>(): Effect.Effect<A, PreparationDataError> =>
  Effect.die('Repository operation is not used by this publication test.')

const makeRepository = (
  overrides: Partial<PreparationRepositoryShape>
): PreparationRepositoryShape => ({
  appendRevision: () => unimplemented(),
  approveRevision: () => unimplemented(),
  createPreparationApplication: () => unimplemented(),
  loadBootstrap: () => unimplemented(),
  loadContentEntry: () => unimplemented(),
  loadContentHead: () => unimplemented(),
  loadContentRevisionHistory: () => unimplemented(),
  loadCvGenerationGuidance: () => unimplemented(),
  loadContext: () => unimplemented(),
  loadCvPageState: () => unimplemented(),
  loadPreparationHead: () => unimplemented(),
  loadWorkflowBootstrap: () => unimplemented(),
  persistManualJobContext: () => unimplemented(),
  readCurrentPdf: () => unimplemented(),
  readPdfJob: () => unimplemented(),
  refreshSnapshot: () => unimplemented(),
  setPublicationAvailability: () => unimplemented(),
  stageCv: () => unimplemented(),
  startPdfGeneration: () => unimplemented(),
  startPreparation: () => unimplemented(),
  updatePreparationApplication: () => unimplemented(),
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

const execute = (repository: PreparationRepositoryShape) =>
  Effect.gen(function* () {
    const progress = yield* CvPublicationProgress
    const executionId = yield* PublishCvWorkflow.executionId(input)
    yield* progress.reserve(input, executionId)
    const exit = yield* Effect.exit(PublishCvWorkflow.execute(input))
    return {
      exit,
      run: (yield* SubscriptionRef.get(progress.runs)).get(input.runId),
    }
  }).pipe(Effect.provide(testLayer(repository)), Effect.runPromise)

describe('session CV publication Workflow', () => {
  test('makes the staged page public and starts PDF generation', async () => {
    const availabilityRequests: boolean[] = []
    const observed = await execute(
      makeRepository({
        setPublicationAvailability: ({ input: request }) =>
          Effect.sync(() => {
            availabilityRequests.push(request.enabled)
            return link
          }),
        startPdfGeneration: () => Effect.succeed(runningPdf),
      })
    )

    expect(Exit.isSuccess(observed.exit)).toBe(true)
    if (Exit.isFailure(observed.exit)) throw new Error('Expected success.')
    expect(observed.exit.value.link).toEqual(link)
    expect(observed.exit.value.job).toEqual(runningPdf)
    expect(observed.exit.value.pdfStartError).toBeNull()
    expect(availabilityRequests).toEqual([true])
    expect(observed.run?._tag).toBe('Published')
  })

  test('disables the page and fails when PDF generation cannot start', async () => {
    const availabilityRequests: SetCvLinkAvailabilityRequest[] = []
    const observed = await execute(
      makeRepository({
        setPublicationAvailability: ({ input: request }) =>
          Effect.sync(() => {
            availabilityRequests.push(request)
            return request.enabled
              ? link
              : {
                  ...link,
                  disabledAt: recordedAt,
                  disabledReason: request.reason ?? null,
                  enabled: false,
                  publicationVersion: link.publicationVersion,
                  version: link.version + 1,
                }
          }),
        startPdfGeneration: () =>
          Effect.fail(
            new PreparationDataError({
              message: 'PDF Queue unavailable.',
              operation: 'start-pdf-generation',
            })
          ),
      })
    )

    expect(Exit.isFailure(observed.exit)).toBe(true)
    if (Exit.isSuccess(observed.exit)) throw new Error('Expected failure.')
    const error = Cause.findErrorOption(observed.exit.cause)
    expect(Option.isSome(error)).toBe(true)
    if (Option.isNone(error)) throw new Error('Expected typed failure.')
    expect(error.value).toBeInstanceOf(CvPublicationWorkflowError)
    expect(error.value.stage).toBe('start-pdf')
    expect(error.value.message).toContain('PDF Queue unavailable')
    expect(availabilityRequests).toEqual([
      {
        enabled: true,
        expectedPublicationVersion: input.expectedPublicationVersion,
      },
      {
        enabled: false,
        expectedPublicationVersion: link.publicationVersion,
        reason: pdfGenerationFailedDisableReason,
      },
    ])
    expect(observed.run?._tag).toBe('Failed')
  })

  test('preserves the PDF start failure when disabling the page also fails', async () => {
    const availabilityRequests: SetCvLinkAvailabilityRequest[] = []
    const observed = await execute(
      makeRepository({
        setPublicationAvailability: ({ input: request }) => {
          availabilityRequests.push(request)
          return request.enabled
            ? Effect.succeed(link)
            : Effect.fail(
                new PreparationDataError({
                  message: 'Publication version changed during cleanup.',
                  operation: 'set-publication-availability',
                })
              )
        },
        startPdfGeneration: () =>
          Effect.fail(
            new PreparationDataError({
              message: 'PDF Queue unavailable.',
              operation: 'start-pdf-generation',
            })
          ),
      })
    )

    expect(Exit.isFailure(observed.exit)).toBe(true)
    if (Exit.isSuccess(observed.exit)) throw new Error('Expected failure.')
    const error = Cause.findErrorOption(observed.exit.cause)
    expect(Option.isSome(error)).toBe(true)
    if (Option.isNone(error)) throw new Error('Expected typed failure.')
    expect(error.value).toBeInstanceOf(CvPublicationWorkflowError)
    expect(error.value.stage).toBe('start-pdf')
    expect(error.value.message).toContain('PDF Queue unavailable')
    expect(error.value.message).not.toContain('during cleanup')
    expect(availabilityRequests.at(-1)).toEqual({
      enabled: false,
      expectedPublicationVersion: link.publicationVersion,
      reason: pdfGenerationFailedDisableReason,
    })
    expect(observed.run?._tag).toBe('Failed')
  })

  test('fails before PDF generation when the page cannot be enabled', async () => {
    let pdfStarts = 0
    const observed = await execute(
      makeRepository({
        setPublicationAvailability: () =>
          Effect.fail(
            new PreparationDataError({
              message: 'Publication version changed.',
              operation: 'set-publication-availability',
            })
          ),
        startPdfGeneration: () =>
          Effect.sync(() => {
            pdfStarts += 1
            return runningPdf
          }),
      })
    )

    expect(Exit.isFailure(observed.exit)).toBe(true)
    if (Exit.isSuccess(observed.exit)) throw new Error('Expected failure.')
    const error = Cause.findErrorOption(observed.exit.cause)
    expect(Option.isSome(error)).toBe(true)
    if (Option.isNone(error)) throw new Error('Expected typed failure.')
    expect(error.value).toBeInstanceOf(CvPublicationWorkflowError)
    expect(error.value.stage).toBe('enable-page')
    expect(pdfStarts).toBe(0)
    expect(observed.run?._tag).toBe('Failed')
  })

  test('cancels an active session workflow immediately', async () => {
    const cancelledInput = { ...input, runId: 'publication-run-cancelled' }
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const enabling = yield* Deferred.make<void>()
        const neverEnable = yield* Deferred.make<void>()
        const repository = makeRepository({
          setPublicationAvailability: () =>
            Effect.gen(function* () {
              yield* Deferred.succeed(enabling, undefined)
              yield* Deferred.await(neverEnable)
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
          yield* Deferred.await(enabling)
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

  test('disables the page when publication is cancelled during PDF startup', async () => {
    const cancelledInput = {
      ...input,
      runId: 'publication-run-cancelled-during-pdf',
    }
    const availabilityRequests: SetCvLinkAvailabilityRequest[] = []
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const startingPdf = yield* Deferred.make<void>()
        const neverStart = yield* Deferred.make<void>()
        const repository = makeRepository({
          setPublicationAvailability: ({ input: request }) =>
            Effect.sync(() => {
              availabilityRequests.push(request)
              return request.enabled
                ? link
                : {
                    ...link,
                    disabledAt: recordedAt,
                    disabledReason: request.reason ?? null,
                    enabled: false,
                    publicationVersion: link.publicationVersion,
                    version: link.version + 1,
                  }
            }),
          startPdfGeneration: () =>
            Effect.gen(function* () {
              yield* Deferred.succeed(startingPdf, undefined)
              yield* Deferred.await(neverStart)
              return runningPdf
            }),
        })

        return yield* Effect.gen(function* () {
          const progress = yield* CvPublicationProgress
          const executionId =
            yield* PublishCvWorkflow.executionId(cancelledInput)
          yield* progress.reserve(cancelledInput, executionId)
          yield* PublishCvWorkflow.execute(cancelledInput, { discard: true })
          yield* Deferred.await(startingPdf)
          yield* cancelCvPublication({
            executionId,
            runId: cancelledInput.runId,
          })
          return {
            requests: availabilityRequests,
            run: (yield* SubscriptionRef.get(progress.runs)).get(
              cancelledInput.runId
            ),
          }
        }).pipe(Effect.provide(testLayer(repository)))
      })
    )

    expect(observed.requests).toEqual([
      {
        enabled: true,
        expectedPublicationVersion: cancelledInput.expectedPublicationVersion,
      },
      {
        enabled: false,
        expectedPublicationVersion: link.publicationVersion,
        reason: pdfGenerationFailedDisableReason,
      },
    ])
    expect(observed.run?._tag).toBe('Cancelled')
  })
})
