import type { CampaignCapture } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type { PersistedCapture } from '../types'

export interface CapturesCrud {
  readonly findByOperation: (
    operationId: string
  ) => Effect.Effect<CampaignCapture | undefined, RegistryDatabaseError>
  readonly listByApplication: (
    applicationId: string
  ) => Effect.Effect<readonly CampaignCapture[], RegistryDatabaseError>
  readonly persist: (
    input: PersistedCapture
  ) => Effect.Effect<void, RegistryDatabaseError>
}

export const CapturesCrud = Context.Service<CapturesCrud>(
  '@cv/application-registry-crud/CapturesCrud'
)
