import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import {
  findApplicationByIdentifier,
  findApplicationByJobKey,
  listApplicationFacets,
  listApplications,
  patchApplication,
  persistApplication,
  removeApplication,
} from '../persistence/applications'
import { persistEvent } from '../persistence/event-write'
import { ApplicationsCrud } from '../services/applications'

export const makeApplicationsCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(ApplicationsCrud, {
    facets: () =>
      withRegistryConnections(database, ({ query }) =>
        listApplicationFacets(query)
      ),
    findByIdentifier: (identifier) =>
      withRegistryConnections(database, ({ query }) =>
        findApplicationByIdentifier(query, identifier)
      ),
    findByJobKey: (jobKey) =>
      withRegistryConnections(database, ({ query }) =>
        findApplicationByJobKey(query, jobKey)
      ),
    list: (filter) =>
      withRegistryConnections(database, ({ query }) =>
        listApplications(query, filter)
      ),
    patch: (applicationId, patch, recordedAt) =>
      withRegistryConnections(database, (connections) =>
        patchApplication(connections, applicationId, patch, recordedAt)
      ),
    persist: (input, options) =>
      withRegistryConnections(database, (connections) =>
        persistApplication(connections, input, options)
      ),
    persistEvent: (
      applicationId,
      expectedVersion,
      nextApplicationStatus,
      input
    ) =>
      withRegistryConnections(database, (connections) =>
        persistEvent(
          connections,
          applicationId,
          expectedVersion,
          nextApplicationStatus,
          input
        )
      ),
    remove: (applicationId, expectedVersion) =>
      withRegistryConnections(database, ({ query }) =>
        removeApplication(query, applicationId, expectedVersion)
      ),
  })
