import { Effect } from 'effect'

import { RegistryDatabaseError } from '../errors'
import type { RegistryDatabase } from '../internal/connection'
import type { PersistApplicationOptions, PersistedApplication } from '../types'
import { persistApplicationAggregate } from './application-values'
import { allocateRevision, runTransaction } from './shared'

export const persistApplication = (
  database: RegistryDatabase,
  input: PersistedApplication,
  options: PersistApplicationOptions
) =>
  runTransaction(database, options.operation, (transaction) =>
    Effect.gen(function* () {
      const revision = yield* allocateRevision(transaction)
      const inserted = yield* persistApplicationAggregate(
        transaction,
        input,
        revision
      )

      if (!inserted) {
        return yield* new RegistryDatabaseError({
          cause: new Error(
            `Posting ${input.postingUrlNormalized} is already registered.`
          ),
          message: `Failed to execute ${options.operation}`,
        })
      }
    })
  )
