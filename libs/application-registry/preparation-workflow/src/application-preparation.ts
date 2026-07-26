import { Context, Crypto, Effect, Layer, Stream, SubscriptionRef } from 'effect'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'
import { approveArtifact, cancelAiWorkflowJob } from './commands/review'
import {
  createAiWorkflowBatch,
  createAiWorkflowJob,
  retryAiWorkflowJob,
} from './commands/start'
import type {
  ApproveArtifactInput,
  CreateAiWorkflowBatchInput,
  CreateAiWorkflowJobInput,
  CreateAiWorkflowJobResult,
  PreparationJob,
} from './domain'
import { projectPreparationJobs } from './domain'
import { makePreparationGatewayLayer, PreparationGateway } from './gateway'
import { PreparationProgress, preparationProgressLayer } from './progress'
import {
  makePreparationConcurrencyLayer,
  preparationWorkflowLayer,
} from './workflow/handler'

export type PreparationJobs = ReadonlyMap<string, PreparationJob>

export type ApplicationPreparationService = {
  readonly cancelJob: (jobId: string) => Effect.Effect<void>
  readonly createBatch: (
    input: CreateAiWorkflowBatchInput
  ) => Effect.Effect<
    ReadonlyArray<CreateAiWorkflowJobResult>,
    Effect.Error<ReturnType<typeof createAiWorkflowBatch>>
  >
  readonly createJob: (
    input: CreateAiWorkflowJobInput
  ) => Effect.Effect<
    CreateAiWorkflowJobResult,
    Effect.Error<ReturnType<typeof createAiWorkflowJob>>
  >
  readonly jobs: SubscriptionRef.SubscriptionRef<PreparationJobs>
  readonly retryJob: (
    jobId: string
  ) => Effect.Effect<
    CreateAiWorkflowJobResult,
    Effect.Error<ReturnType<typeof retryAiWorkflowJob>>
  >
  readonly approveArtifact: (
    input: ApproveArtifactInput
  ) => Effect.Effect<void, Effect.Error<ReturnType<typeof approveArtifact>>>
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
    const initialStates = yield* SubscriptionRef.get(progress.jobs)
    const jobs = yield* SubscriptionRef.make(
      projectPreparationJobs(initialStates)
    )

    yield* SubscriptionRef.changes(progress.jobs).pipe(
      Stream.map(projectPreparationJobs),
      Stream.runForEach((next) => SubscriptionRef.set(jobs, next)),
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
      cancelJob: (jobId) => provideCommandServices(cancelAiWorkflowJob(jobId)),
      createBatch: (input) =>
        provideCommandServices(createAiWorkflowBatch(input)),
      createJob: (input) => provideCommandServices(createAiWorkflowJob(input)),
      jobs,
      retryJob: (jobId) => provideCommandServices(retryAiWorkflowJob(jobId)),
      approveArtifact: (input) =>
        provideCommandServices(approveArtifact(input)),
    })
  })
)

export type ApplicationPreparationLayerOptions = {
  readonly maximumConcurrentGenerationCalls?: number
  readonly maximumConcurrentJobs?: number
}

export const applicationPreparationLayer = (
  options: ApplicationPreparationLayerOptions = {}
) => {
  const servicesLayer = Layer.mergeAll(
    makePreparationGatewayLayer(options.maximumConcurrentGenerationCalls ?? 2),
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
