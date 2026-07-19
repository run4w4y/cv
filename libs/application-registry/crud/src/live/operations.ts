import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import { findIdempotencyReceipt } from '../persistence/operations'
import { IdempotencyCrud } from '../services/operations'

export const makeIdempotencyCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(IdempotencyCrud, {
    find: (idempotencyKey) =>
      withRegistryConnections(database, ({ query }) =>
        findIdempotencyReceipt(query, idempotencyKey)
      ),
  })
