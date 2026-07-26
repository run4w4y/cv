import type { Application } from '@cv/application-registry-entity'
import { Context, Effect, Layer } from 'effect'
import type {
  ContentRevisionResult,
  CoverLetterPreparationInput,
  CvAuthoringPlan,
  CvAuthoringPlanResult,
  CvPreparationInput,
  EvidencePlan,
  EvidencePlanResult,
  GeneratedCandidate,
  JobAnalysis,
  JobAnalysisResult,
  PreparationBootstrap,
  PreparationWorkflowError,
  PreparationWorkflowInput,
  SavedCandidate,
} from '../domain'
import { StructuredGeneration } from '../generation/service'
import { PreparationStore } from '../store'
import { makePreparationContextGateway } from './context'
import { makePreparationGenerationGateway } from './generation'
import { makePreparationPersistenceGateway } from './persistence'

export type PreparationGatewayService = {
  readonly analyze: (
    input: PreparationWorkflowInput,
    bootstrap: PreparationBootstrap
  ) => Effect.Effect<JobAnalysisResult, PreparationWorkflowError>
  readonly bootstrap: (
    input: PreparationWorkflowInput,
    application: Application
  ) => Effect.Effect<PreparationBootstrap, PreparationWorkflowError>
  readonly composeCoverLetter: (
    input: CoverLetterPreparationInput,
    bootstrap: PreparationBootstrap,
    analysis: JobAnalysis,
    evidencePlan: EvidencePlan
  ) => Effect.Effect<
    Extract<GeneratedCandidate, { readonly _tag: 'CoverLetter' }>,
    PreparationWorkflowError
  >
  readonly composeCv: (
    input: CvPreparationInput,
    bootstrap: PreparationBootstrap,
    analysis: JobAnalysis,
    plan: CvAuthoringPlan
  ) => Effect.Effect<
    Extract<GeneratedCandidate, { readonly _tag: 'Cv' }>,
    PreparationWorkflowError
  >
  readonly enrichApplication: (
    input: PreparationWorkflowInput,
    bootstrap: PreparationBootstrap,
    analysis: JobAnalysis
  ) => Effect.Effect<Application, PreparationWorkflowError>
  readonly ensureApplication: (
    input: PreparationWorkflowInput
  ) => Effect.Effect<Application, PreparationWorkflowError>
  readonly planEvidence: (
    input: PreparationWorkflowInput,
    bootstrap: PreparationBootstrap,
    analysis: JobAnalysis
  ) => Effect.Effect<EvidencePlanResult, PreparationWorkflowError>
  readonly planCv: (
    input: CvPreparationInput,
    bootstrap: PreparationBootstrap,
    analysis: JobAnalysis,
    evidencePlan: EvidencePlan
  ) => Effect.Effect<CvAuthoringPlanResult, PreparationWorkflowError>
  readonly saveCandidate: (
    input: PreparationWorkflowInput,
    bootstrap: PreparationBootstrap,
    candidate: GeneratedCandidate
  ) => Effect.Effect<SavedCandidate, PreparationWorkflowError>
  readonly approveBoundRevision: (
    candidate: SavedCandidate,
    selectedRevisionId: string
  ) => Effect.Effect<ContentRevisionResult, PreparationWorkflowError>
  readonly verifyBoundRevision: (
    candidate: SavedCandidate,
    selectedRevisionId: string
  ) => Effect.Effect<ContentRevisionResult, PreparationWorkflowError>
}

export class PreparationGateway extends Context.Service<
  PreparationGateway,
  PreparationGatewayService
>()('@cv/application-registry/PreparationGateway') {}

export const makePreparationGatewayLayer = (
  maximumConcurrentGenerationCalls: number
) =>
  Layer.effect(
    PreparationGateway,
    Effect.gen(function* () {
      const repository = yield* PreparationStore
      const structuredGeneration = yield* StructuredGeneration

      const context = makePreparationContextGateway(repository)
      const generationGateway = yield* makePreparationGenerationGateway(
        structuredGeneration,
        maximumConcurrentGenerationCalls
      )
      const persistence = makePreparationPersistenceGateway(repository)

      return PreparationGateway.of({
        ...context,
        ...generationGateway,
        ...persistence,
      })
    })
  )

export const preparationGatewayLayer = makePreparationGatewayLayer(2)
