import type { ApplicationEvent } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type { CrudPage, EventListFilter } from '../types'

export interface EventsCrud {
  readonly findByOperation: (
    operationId: string
  ) => Effect.Effect<ApplicationEvent | undefined, RegistryDatabaseError>
  readonly list: (
    filter: EventListFilter
  ) => Effect.Effect<CrudPage<ApplicationEvent>, RegistryDatabaseError>
  readonly listByApplication: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationEvent[], RegistryDatabaseError>
}

export const EventsCrud = Context.Service<EventsCrud>(
  '@cv/application-registry-crud/EventsCrud'
)
