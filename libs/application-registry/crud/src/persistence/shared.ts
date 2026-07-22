import { registrySequence } from '@cv/application-registry-entity'
import { sql } from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure, RegistryDatabaseError } from '../errors'
import type {
  RegistryDatabase,
  RegistryExecutor,
  RegistryTransaction,
} from '../internal/connection'

/** Allocates the mutation revision inside the caller's transaction. */
export const allocateRevision = (database: RegistryExecutor) =>
  database
    .insert(registrySequence)
    .values({ id: 1, revision: 1 })
    .onConflictDoUpdate({
      target: registrySequence.id,
      set: { revision: sql`${registrySequence.revision} + 1` },
    })
    .returning({ revision: registrySequence.revision })
    .pipe(
      Effect.flatMap((rows) => {
        const row = rows.at(0)
        return row === undefined
          ? Effect.fail(
              new RegistryDatabaseError({
                cause: new Error(
                  'Registry revision allocation returned no row.'
                ),
                message: 'Failed to allocate registry revision',
              })
            )
          : Effect.succeed(row.revision)
      })
    )

export const runTransaction = <A, E, R>(
  database: RegistryDatabase,
  operation: string,
  transaction: (database: RegistryTransaction) => Effect.Effect<A, E, R>
): Effect.Effect<A, RegistryDatabaseError, R> =>
  database
    .transaction(transaction)
    .pipe(Effect.mapError(databaseFailure(`Failed to execute ${operation}`)))
