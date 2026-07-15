import type { ApplicationEvent } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  AppendApplicationEventInput,
  AppendApplicationEventResult,
  EventListPage,
  ListEventsInput,
  RegistryItems,
} from '../types'

export interface EventsService {
  readonly append: (
    identifier: string,
    input: AppendApplicationEventInput
  ) => Effect.Effect<AppendApplicationEventResult, ApplicationRegistryError>
  readonly list: (
    input: ListEventsInput
  ) => Effect.Effect<EventListPage, ApplicationRegistryError>
  readonly listByApplication: (
    identifier: string
  ) => Effect.Effect<RegistryItems<ApplicationEvent>, ApplicationRegistryError>
}

export const EventsService = Context.Service<EventsService>(
  '@cv/application-registry-service/EventsService'
)
