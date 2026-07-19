import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import {
  listActivities,
  listApplicationActivities,
} from '../persistence/activities'
import { ActivitiesCrud } from '../services/activities'

export const makeActivitiesCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(ActivitiesCrud, {
    list: (resolved) =>
      withRegistryConnections(database, ({ query }) =>
        listActivities(query, resolved)
      ),
    listByApplication: (applicationId) =>
      withRegistryConnections(database, ({ query }) =>
        listApplicationActivities(query, applicationId)
      ),
  })
