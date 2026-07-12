import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import { findOperation } from '../persistence/operations'
import { OperationsCrud } from '../services/operations'

export const makeOperationsCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(OperationsCrud, {
    find: (operationId) =>
      withRegistryConnections(database, ({ query }) =>
        findOperation(query, operationId)
      ),
  })
