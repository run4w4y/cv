import type { CurrencyCode } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type { ApplicationCompensationsResult } from '../types'

export interface CompensationsService {
  readonly listByApplication: (
    identifier: string,
    quoteCurrency?: CurrencyCode
  ) => Effect.Effect<ApplicationCompensationsResult, ApplicationRegistryError>
}

export const CompensationsService = Context.Service<CompensationsService>(
  '@cv/application-registry-service/CompensationsService'
)
