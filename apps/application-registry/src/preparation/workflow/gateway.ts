import { AiProvider } from '@cv/ai-provider'
import type { ContentRevisionResultResponse } from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { Context, Crypto, Effect, Layer } from 'effect'

import { RegistryClient } from '../../lib/registry-client'
import type {
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
} from './domain'
import { makePreparationContextGateway } from './gateway/context'
import { makePreparationGenerationGateway } from './gateway/generation'
import { makePreparationPersistenceGateway } from './gateway/persistence'

export {
  verifyApprovedRevisionBinding,
  verifyRevisionSelectionBinding,
} from './gateway/review-binding'
export { decodeOpaqueValue } from './gateway/shared'
export {
  collectReviewedFactIds,
  validateCvProvenance,
  validateEvidencePlan,
  validateJobAnalysis,
  validateSectionBrief,
} from './gateway/validation'

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
  ) => Effect.Effect<ContentRevisionResultResponse, PreparationWorkflowError>
  readonly verifyBoundRevision: (
    candidate: SavedCandidate,
    selectedRevisionId: string
  ) => Effect.Effect<ContentRevisionResultResponse, PreparationWorkflowError>
  readonly sectionIds: (
    kind: PreparationWorkflowInput['kind']
  ) => ReadonlyArray<string>
}

export class PreparationGateway extends Context.Service<
  PreparationGateway,
  PreparationGatewayService
>()('@cv/application-registry/PreparationGateway') {}

export const preparationGatewayLayer = Layer.effect(
  PreparationGateway,
  Effect.gen(function* () {
    const registry = yield* RegistryClient
    const ai = yield* AiProvider
    const crypto = yield* Crypto.Crypto

    const context = makePreparationContextGateway(registry, crypto)
    const generation = yield* makePreparationGenerationGateway(ai)
    const persistence = makePreparationPersistenceGateway(registry)

    return PreparationGateway.of({
      ...context,
      ...generation,
      ...persistence,
    })
  })
)
