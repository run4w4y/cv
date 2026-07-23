import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type { ApplicationCompensationsResult } from '../types'

export interface CompensationsService {
  readonly listByApplication: (
    identifier: string
  ) => Effect.Effect<ApplicationCompensationsResult, ApplicationRegistryError>
}

export const CompensationsService = Context.Service<CompensationsService>(
  '@cv/application-registry-service/CompensationsService'
)
