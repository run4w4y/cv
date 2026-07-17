import type { CurrencyCode } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  ApplicationCompensationsResult,
  ReplaceAnnualCompensationInput,
  ReplaceAnnualCompensationResult,
} from '../types'

export interface CompensationsService {
  readonly listByApplication: (
    identifier: string,
    quoteCurrency?: CurrencyCode
  ) => Effect.Effect<ApplicationCompensationsResult, ApplicationRegistryError>
  readonly replaceAnnual: (
    identifier: string,
    input: ReplaceAnnualCompensationInput
  ) => Effect.Effect<ReplaceAnnualCompensationResult, ApplicationRegistryError>
}

export const CompensationsService = Context.Service<CompensationsService>(
  '@cv/application-registry-service/CompensationsService'
)
