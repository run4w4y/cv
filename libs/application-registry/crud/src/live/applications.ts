import { Layer } from 'effect'
import type { RegistryDatabase } from '../internal/connection'
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

export const makeApplicationsCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(ApplicationsCrud, {
    facets: () => listApplicationFacets(database),
    findByIdentifier: (identifier) =>
      findApplicationByIdentifier(database, identifier),
    findByPostingFingerprint: (fingerprint) =>
      findApplicationByPostingFingerprint(database, fingerprint),
    findByPostingUrl: (postingUrlNormalized) =>
      findApplicationsByPostingUrl(database, postingUrlNormalized),
    list: (resolved) => listApplications(database, resolved),
    patch: (applicationId, patch, recordedAt) =>
      patchApplication(database, applicationId, patch, recordedAt),
    updateManaged: (applicationId, input) =>
      updateManagedApplication(database, applicationId, input),
    persist: (input, options) => persistApplication(database, input, options),
    remove: (applicationId, expectedVersion) =>
      removeApplication(database, applicationId, expectedVersion),
  })
