import { idempotencyReceipts } from '@cv/application-registry-entity'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { databaseFailure } from '../errors'
import type { RegistryExecutor } from '../internal/connection'

export const findIdempotencyReceipt = (
  database: RegistryExecutor,
  idempotencyKey: string
) =>
  database
    .select()
    .from(idempotencyReceipts)
    .where(eq(idempotencyReceipts.idempotencyKey, idempotencyKey))
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to load idempotency receipt'))
    )
