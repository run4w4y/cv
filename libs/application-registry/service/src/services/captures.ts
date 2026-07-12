import type { CampaignCapture } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  CreateCampaignCaptureInput,
  CreateCampaignCaptureResult,
  RegistryItems,
} from '../types'

export interface CapturesService {
  readonly capture: (
    input: CreateCampaignCaptureInput
  ) => Effect.Effect<CreateCampaignCaptureResult, ApplicationRegistryError>
  readonly listByApplication: (
    identifier: string
  ) => Effect.Effect<RegistryItems<CampaignCapture>, ApplicationRegistryError>
}

export const CapturesService = Context.Service<CapturesService>(
  '@cv/application-registry-service/CapturesService'
)
