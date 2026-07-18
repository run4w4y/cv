import type { FactsChannel } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { FactsReleasesServiceError } from '../errors'
import type {
  ActiveFactsAssetContent,
  ActiveFactsCatalogContent,
  ActiveFactsContent,
  ActiveFactsRelease,
  FactsReleaseRecord,
  RegisterFactsReleaseInput,
} from '../types'

export interface FactsReleasesService {
  readonly activate: (
    channel: string,
    releaseId: string,
    expectedVersion: number
  ) => Effect.Effect<FactsChannel, FactsReleasesServiceError>
  readonly find: (
    releaseId: string
  ) => Effect.Effect<FactsReleaseRecord, FactsReleasesServiceError>
  readonly findActive: (
    channel: string,
    locale: string
  ) => Effect.Effect<ActiveFactsRelease, FactsReleasesServiceError>
  readonly readActive: (
    channel: string,
    locale: string
  ) => Effect.Effect<ActiveFactsContent, FactsReleasesServiceError>
  readonly readActiveAsset: (
    channel: string,
    locale: string,
    assetId: string
  ) => Effect.Effect<ActiveFactsAssetContent, FactsReleasesServiceError>
  readonly readActiveCatalog: (
    channel: string,
    locale: string
  ) => Effect.Effect<ActiveFactsCatalogContent, FactsReleasesServiceError>
  readonly register: (
    input: RegisterFactsReleaseInput
  ) => Effect.Effect<FactsReleaseRecord, FactsReleasesServiceError>
}

export const FactsReleasesService = Context.Service<FactsReleasesService>(
  '@cv/application-registry-service/FactsReleasesService'
)
