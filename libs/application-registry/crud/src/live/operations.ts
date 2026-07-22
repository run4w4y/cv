import { Layer } from 'effect'
import type { RegistryDatabase } from '../internal/connection'
import { findIdempotencyReceipt } from '../persistence/operations'
import { IdempotencyCrud } from '../services/operations'

export const makeIdempotencyCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(IdempotencyCrud, {
    find: (idempotencyKey) => findIdempotencyReceipt(database, idempotencyKey),
  })
