import { Context, Crypto, Effect, Layer, Stream, SubscriptionRef } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { startPreparation, startPreparationBatch } from './commands/start'
import {
  cancelPreparationRun,
  submitPreparationReviewForRun,
} from './commands/review'
import type {
  PreparationRun,
  StartPreparationBatchInput,
  StartPreparationInput,
  StartPreparationResult,
  SubmitPreparationReviewInput,
} from './domain'
import { projectPreparationRuns } from './domain'
import { makePreparationGatewayLayer, PreparationGateway } from './gateway'
import { PreparationProgress, preparationProgressLayer } from './progress'
import {
  makePreparationConcurrencyLayer,
  preparationWorkflowLayer,
} from './workflow/handler'

export type PreparationRuns = ReadonlyMap<string, PreparationRun>

export type ApplicationPreparationService = {
  readonly cancel: (runId: string) => Effect.Effect<void>
  readonly runs: SubscriptionRef.SubscriptionRef<PreparationRuns>
  readonly start: (
    input: StartPreparationInput
  ) => Effect.Effect<
    StartPreparationResult,
    Effect.Error<ReturnType<typeof startPreparation>>
  >
  readonly startBatch: (
    input: StartPreparationBatchInput
  ) => Effect.Effect<
    ReadonlyArray<StartPreparationResult>,
    Effect.Error<ReturnType<typeof startPreparationBatch>>
  >
  readonly submitReview: (
    input: SubmitPreparationReviewInput
  ) => Effect.Effect<
    void,
    Effect.Error<ReturnType<typeof submitPreparationReviewForRun>>
  >
}

export class ApplicationPreparation extends Context.Service<
  ApplicationPreparation,
  ApplicationPreparationService
>()('@cv/application-preparation-workflow/ApplicationPreparation') {}

const applicationPreparationServiceLayer = Layer.effect(
  ApplicationPreparation,
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto
    const engine = yield* WorkflowEngine.WorkflowEngine
    const gateway = yield* PreparationGateway
    const progress = yield* PreparationProgress
    const initialStates = yield* SubscriptionRef.get(progress.runs)
    const runs = yield* SubscriptionRef.make(
      projectPreparationRuns(initialStates)
    )

    yield* SubscriptionRef.changes(progress.runs).pipe(
      Stream.map(projectPreparationRuns),
      Stream.runForEach((next) => SubscriptionRef.set(runs, next)),
      Effect.forkScoped
    )

    const provideCommandServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
        Effect.provideService(PreparationGateway, gateway),
        Effect.provideService(PreparationProgress, progress)
      )

    return ApplicationPreparation.of({
      cancel: (runId) => provideCommandServices(cancelPreparationRun(runId)),
      runs,
      start: (input) => provideCommandServices(startPreparation(input)),
      startBatch: (input) =>
        provideCommandServices(startPreparationBatch(input)),
      submitReview: (input) =>
        provideCommandServices(submitPreparationReviewForRun(input)),
    })
  })
)

export type ApplicationPreparationLayerOptions = {
  readonly maximumConcurrentAiCalls?: number
  readonly maximumConcurrentJobs?: number
}

export const applicationPreparationLayer = (
  options: ApplicationPreparationLayerOptions = {}
) => {
  const servicesLayer = Layer.mergeAll(
    makePreparationGatewayLayer(options.maximumConcurrentAiCalls ?? 2),
    preparationProgressLayer,
    makePreparationConcurrencyLayer(options.maximumConcurrentJobs ?? 3)
  )
  const handlerLayer = preparationWorkflowLayer.pipe(
    Layer.provide(servicesLayer)
  )
  const serviceLayer = applicationPreparationServiceLayer.pipe(
    Layer.provide(servicesLayer)
  )
  return Layer.merge(handlerLayer, serviceLayer)
}
