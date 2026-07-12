import { commandReceipts } from '@cv/application-registry-entity'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'

import type { RegistryQueryDatabase } from '../database'
import { databaseFailure } from '../errors'

export const findOperation = (
  database: RegistryQueryDatabase,
  operationId: string
) =>
  database
    .select()
    .from(commandReceipts)
    .where(eq(commandReceipts.operationId, operationId))
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to load operation receipt'))
    )
