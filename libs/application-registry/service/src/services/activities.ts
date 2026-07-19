import type { ApplicationActivity } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  ActivityListPage,
  ListActivitiesInput,
  RegistryItems,
} from '../types'

export interface ActivitiesService {
  readonly list: (
    input: ListActivitiesInput
  ) => Effect.Effect<ActivityListPage, ApplicationRegistryError>
  readonly listByApplication: (
    identifier: string
  ) => Effect.Effect<
    RegistryItems<ApplicationActivity>,
    ApplicationRegistryError
  >
}

export const ActivitiesService = Context.Service<ActivitiesService>(
  '@cv/application-registry-service/ActivitiesService'
)
