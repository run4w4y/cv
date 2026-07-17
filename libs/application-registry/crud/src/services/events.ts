import type { ApplicationEvent } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type {
  RegistryDatabaseError,
  RegistryQueryTooComplexError,
} from '../errors'
import type { EventListPage, EventListResolution } from '../types'

export interface EventsCrud {
  readonly findByOperation: (
    operationId: string
  ) => Effect.Effect<ApplicationEvent | undefined, RegistryDatabaseError>
  readonly list: (
    query: EventListResolution
  ) => Effect.Effect<
    EventListPage,
    RegistryDatabaseError | RegistryQueryTooComplexError
  >
  readonly listByApplication: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationEvent[], RegistryDatabaseError>
}

export const EventsCrud = Context.Service<EventsCrud>(
  '@cv/application-registry-crud/EventsCrud'
)
