import type { ApplicationCompensation } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'

export interface CompensationsCrud {
  readonly listByApplication: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationCompensation[], RegistryDatabaseError>
}

export const CompensationsCrud = Context.Service<CompensationsCrud>(
  '@cv/application-registry-crud/CompensationsCrud'
)
