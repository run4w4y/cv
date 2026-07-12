import type { D1Database } from '@cloudflare/workers-types'
import { Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import { persistCapture } from '../persistence/capture'
import {
  findCaptureByOperation,
  listApplicationCaptures,
} from '../persistence/events'
import { CapturesCrud } from '../services/captures'

export const makeCapturesCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(CapturesCrud, {
    findByOperation: (operationId) =>
      withRegistryConnections(database, ({ query }) =>
        findCaptureByOperation(query, operationId)
      ),
    listByApplication: (applicationId) =>
      withRegistryConnections(database, ({ query }) =>
        listApplicationCaptures(query, applicationId)
      ),
    persist: (input) =>
      withRegistryConnections(database, (connections) =>
        persistCapture(connections, input).pipe(Effect.asVoid)
      ),
  })
