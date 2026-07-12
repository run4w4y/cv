import { Effect, Layer } from 'effect'

import { RegistryDatabase } from '../../database'
import {
  findEventByOperation,
  listApplicationEvents,
  listEvents,
} from '../../persistence/events'
import { EventsCrud } from '../../services/events'

const makeEventsCrudD1 = Effect.map(RegistryDatabase, (database) =>
  EventsCrud.of({
    findByOperation: (operationId) =>
      database.use(({ query }) => findEventByOperation(query, operationId)),
    list: (filter) => database.use(({ query }) => listEvents(query, filter)),
    listByApplication: (applicationId) =>
      database.use(({ query }) => listApplicationEvents(query, applicationId)),
  })
)

export const EventsCrudD1Live = Layer.effect(EventsCrud, makeEventsCrudD1)
