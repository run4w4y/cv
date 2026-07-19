import { AiProvider } from '@cv/ai-provider'
import type { Application } from '@cv/application-registry-entity'
import { Context, Effect, Layer } from 'effect'
import type {
  ContentRevisionResult,
  EvidencePlan,
  EvidencePlanResult,
  GeneratedCandidate,
  JobAnalysis,
  JobAnalysisResult,
  PreparationBootstrap,
  PreparationWorkflowError,
  PreparationWorkflowInput,
  SavedCandidate,
  SectionBrief,
  SectionBriefResult,
} from '../domain'
import { PreparationStore } from '../store'
import { makePreparationContextGateway } from './context'
import { makePreparationGenerationGateway } from './generation'
import { makePreparationPersistenceGateway } from './persistence'

export {
  verifyApprovedRevisionBinding,
  verifyRevisionSelectionBinding,
} from './review-binding'
export {
  validateCvProvenance,
  validateEvidencePlan,
  validateSectionBrief,
} from './validation'

export type PreparationGatewayService = {
  readonly analyze: (
    input: PreparationWorkflowInput,
    bootstrap: PreparationBootstrap
  ) => Effect.Effect<JobAnalysisResult, PreparationWorkflowError>
  readonly bootstrap: (
    input: PreparationWorkflowInput,
    application: Application
  ) => Effect.Effect<PreparationBootstrap, PreparationWorkflowError>
  readonly brief: (
    input: PreparationWorkflowInput,
    bootstrap: PreparationBootstrap,
    analysis: JobAnalysis,
    plan: EvidencePlan,
    sectionId: string
  ) => Effect.Effect<SectionBriefResult, PreparationWorkflowError>
  readonly compose: (
    input: PreparationWorkflowInput,
    bootstrap: PreparationBootstrap,
    analysis: JobAnalysis,
    plan: EvidencePlan,
    briefs: ReadonlyArray<SectionBrief>
  ) => Effect.Effect<GeneratedCandidate, PreparationWorkflowError>
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
  readonly sectionIds: (
    kind: PreparationWorkflowInput['kind']
  ) => ReadonlyArray<string>
}

export class PreparationGateway extends Context.Service<
  PreparationGateway,
  PreparationGatewayService
>()('@cv/application-registry/PreparationGateway') {}

export const makePreparationGatewayLayer = (maximumConcurrentAiCalls: number) =>
  Layer.effect(
    PreparationGateway,
    Effect.gen(function* () {
      const repository = yield* PreparationStore
      const ai = yield* AiProvider

      const context = makePreparationContextGateway(repository)
      const generation = yield* makePreparationGenerationGateway(
        ai,
        maximumConcurrentAiCalls
      )
      const persistence = makePreparationPersistenceGateway(repository)

      return PreparationGateway.of({
        ...context,
        ...generation,
        ...persistence,
      })
    })
  )

export const preparationGatewayLayer = makePreparationGatewayLayer(2)
