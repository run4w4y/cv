import type { ApplicationCompensation } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type { PersistedAnnualCompensation } from '../types'

export interface CompensationsCrud {
  readonly listByApplication: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationCompensation[], RegistryDatabaseError>
  readonly replaceAnnual: (
    applicationId: string,
    expectedVersion: number,
    replacement: PersistedAnnualCompensation | null,
    recordedAt: string
  ) => Effect.Effect<boolean, RegistryDatabaseError>
}

export const CompensationsCrud = Context.Service<CompensationsCrud>(
  '@cv/application-registry-crud/CompensationsCrud'
)
