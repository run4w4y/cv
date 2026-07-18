import { Context, type Effect } from 'effect'

import type { AiJsonGenerationFailure, AiModelDiscoveryFailure } from './errors'
import type {
  AiJsonGenerationRequest,
  AiJsonGenerationResult,
  AiModel,
  AiModelDiscoveryOptions,
} from './model'

export type AiProviderShape = {
  readonly discoverModels: (
    options?: AiModelDiscoveryOptions
  ) => Effect.Effect<ReadonlyArray<AiModel>, AiModelDiscoveryFailure>
  readonly generateJson: <Output>(
    request: AiJsonGenerationRequest
  ) => Effect.Effect<AiJsonGenerationResult<Output>, AiJsonGenerationFailure>
}

export class AiProvider extends Context.Service<AiProvider, AiProviderShape>()(
  '@cv/ai-provider/AiProvider'
) {}
