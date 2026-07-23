import type { ApplicationActivity } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type { ActivityListPage, ActivityListResolution } from '../types'

export interface ActivitiesCrud {
  readonly list: (
    query: ActivityListResolution
  ) => Effect.Effect<ActivityListPage, RegistryDatabaseError>
  readonly listByApplication: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationActivity[], RegistryDatabaseError>
}

export const ActivitiesCrud = Context.Service<ActivitiesCrud>(
  '@cv/application-registry-crud/ActivitiesCrud'
)
