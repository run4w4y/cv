import { Effect, Layer } from 'effect'

import { RegistryDatabase } from '../../database'
import { persistCapture } from '../../persistence/capture'
import {
  findCaptureByOperation,
  listApplicationCaptures,
} from '../../persistence/events'
import { CapturesCrud } from '../../services/captures'

const makeCapturesCrudD1 = Effect.map(RegistryDatabase, (database) =>
  CapturesCrud.of({
    findByOperation: (operationId) =>
      database.use(({ query }) => findCaptureByOperation(query, operationId)),
    listByApplication: (applicationId) =>
      database.use(({ query }) =>
        listApplicationCaptures(query, applicationId)
      ),
    persist: (input) =>
      database.use((connections) =>
        persistCapture(connections, input).pipe(Effect.asVoid)
      ),
  })
)

export const CapturesCrudD1Live = Layer.effect(CapturesCrud, makeCapturesCrudD1)
