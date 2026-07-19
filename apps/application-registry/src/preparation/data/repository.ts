import { AiProvider } from '@cv/ai-provider'
import { Context, Crypto, Effect, Layer } from 'effect'

import { RegistryClient } from '../../lib/registry-client'
import { makePreparationContentRepository } from './repository/content'
import {
  makePreparationContextRepository,
  manualJobContextFetcherVersion,
  manualJobContextMaxBytes,
} from './repository/context'
import { makePreparationPublicationRepository } from './repository/publication'
import type { PreparationRepositoryShape } from './types'

export { manualJobContextFetcherVersion, manualJobContextMaxBytes }

export class PreparationRepository extends Context.Service<
  PreparationRepository,
  PreparationRepositoryShape
>()('@cv/application-registry/PreparationRepository') {}

export const preparationRepositoryLayer = Layer.effect(
  PreparationRepository,
  Effect.gen(function* () {
    const registry = yield* RegistryClient
    const ai = yield* AiProvider
    const crypto = yield* Crypto.Crypto

    const content = makePreparationContentRepository(registry, crypto)
    const context = makePreparationContextRepository(
      registry,
      ai,
      content.loadContentHead
    )
    const publication = makePreparationPublicationRepository(registry)

    return PreparationRepository.of({
      ...content,
      ...context,
      ...publication,
    })
  })
)
