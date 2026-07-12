import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import {
  findEventByOperation,
  listApplicationEvents,
  listEvents,
} from '../persistence/events'
import { EventsCrud } from '../services/events'

export const makeEventsCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(EventsCrud, {
    findByOperation: (operationId) =>
      withRegistryConnections(database, ({ query }) =>
        findEventByOperation(query, operationId)
      ),
    list: (filter) =>
      withRegistryConnections(database, ({ query }) =>
        listEvents(query, filter)
      ),
    listByApplication: (applicationId) =>
      withRegistryConnections(database, ({ query }) =>
        listApplicationEvents(query, applicationId)
      ),
  })
