import { FactsReader } from '@cv/facts-reader/reader'
import { Context, Crypto, Effect, Layer } from 'effect'

import { RegistryClient } from '@/lib/registry-client'

import type { PreparationRepositoryShape } from '../types'
import { makePreparationApplicationRepository } from './application'
import { makePreparationContentRepository } from './content'
import { makePreparationContextRepository } from './context'
import {
  makeManualJobContextRepository,
  manualJobContextFetcherVersion,
  manualJobContextMaxBytes,
} from './manual-context'
import { makePreparationPublicationRepository } from './publication'

export { manualJobContextFetcherVersion, manualJobContextMaxBytes }

export class PreparationRepository extends Context.Service<
  PreparationRepository,
  PreparationRepositoryShape
>()('@cv/application-registry/PreparationRepository') {}

export const preparationRepositoryLayer = Layer.effect(
  PreparationRepository,
  Effect.gen(function* () {
    const registry = yield* RegistryClient
    const facts = yield* FactsReader
    const crypto = yield* Crypto.Crypto

    const content = makePreparationContentRepository(registry, crypto)
    const context = makePreparationContextRepository(
      registry,
      facts,
      content.loadContentHead
    )
    const application = makePreparationApplicationRepository(registry)
    const manualContext = makeManualJobContextRepository(registry, crypto)
    const publication = makePreparationPublicationRepository(registry)

    return PreparationRepository.of({
      ...application,
      ...content,
      ...context,
      ...manualContext,
      ...publication,
    })
  })
)
