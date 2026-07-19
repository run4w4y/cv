import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import {
  findApplicationByIdentifier,
  findApplicationByPostingFingerprint,
  findApplicationsByPostingUrl,
  listApplicationFacets,
  listApplications,
  patchApplication,
  persistApplication,
  removeApplication,
  updateManagedApplication,
} from '../persistence/applications'
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
    findByPostingFingerprint: (fingerprint) =>
      withRegistryConnections(database, ({ query }) =>
        findApplicationByPostingFingerprint(query, fingerprint)
      ),
    findByPostingUrl: (postingUrlNormalized) =>
      withRegistryConnections(database, ({ query }) =>
        findApplicationsByPostingUrl(query, postingUrlNormalized)
      ),
    list: (resolved) =>
      withRegistryConnections(database, ({ query }) =>
        listApplications(query, resolved)
      ),
    patch: (applicationId, patch, recordedAt) =>
      withRegistryConnections(database, (connections) =>
        patchApplication(connections, applicationId, patch, recordedAt)
      ),
    updateManaged: (applicationId, input) =>
      withRegistryConnections(database, (connections) =>
        updateManagedApplication(connections, applicationId, input)
      ),
    persist: (input, options) =>
      withRegistryConnections(database, (connections) =>
        persistApplication(connections, input, options)
      ),
    remove: (applicationId, expectedVersion) =>
      withRegistryConnections(database, ({ query }) =>
        removeApplication(query, applicationId, expectedVersion)
      ),
  })
