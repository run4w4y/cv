import { Effect, Layer } from 'effect'

import { RegistryDatabase } from '../../database'
import {
  findApplicationByIdentifier,
  findApplicationByJobKey,
  listApplications,
  patchApplication,
  persistApplication,
  removeApplication,
} from '../../persistence/applications'
import { persistEvent } from '../../persistence/event-write'
import { ApplicationsCrud } from '../../services/applications'

const makeApplicationsCrudD1 = Effect.map(RegistryDatabase, (database) =>
  ApplicationsCrud.of({
    findByIdentifier: (identifier) =>
      database.use(({ query }) =>
        findApplicationByIdentifier(query, identifier)
      ),
    findByJobKey: (jobKey) =>
      database.use(({ query }) => findApplicationByJobKey(query, jobKey)),
    list: (filter) =>
      database.use(({ query }) => listApplications(query, filter)),
    patch: (applicationId, patch, recordedAt) =>
      database.use((connections) =>
        patchApplication(connections, applicationId, patch, recordedAt)
      ),
    persist: (input, options) =>
      database.use((connections) =>
        persistApplication(connections, input, options)
      ),
    persistEvent: (
      applicationId,
      expectedVersion,
      nextApplicationStatus,
      input
    ) =>
      database.use((connections) =>
        persistEvent(
          connections,
          applicationId,
          expectedVersion,
          nextApplicationStatus,
          input
        )
      ),
    remove: (applicationId) =>
      database.use(({ query }) => removeApplication(query, applicationId)),
  })
)

export const ApplicationsCrudD1Live = Layer.effect(
  ApplicationsCrud,
  makeApplicationsCrudD1
)
