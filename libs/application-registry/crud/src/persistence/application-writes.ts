import { applications } from '@cv/application-registry-entity'
import { and, eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure, RegistryDatabaseError } from '../errors'
import type { RegistryDatabase, RegistryExecutor } from '../internal/connection'
import type {
  ApplicationPatch,
  PersistApplicationOptions,
  PersistedApplication,
} from '../types'
import { findApplication } from './application-queries'
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

export const patchApplication = (
  database: RegistryDatabase,
  applicationId: string,
  request: ApplicationPatch,
  recordedAt: string
) => {
  const { expectedVersion, ...changes } = request

  return runTransaction(database, 'application update', (transaction) =>
    Effect.gen(function* () {
      const current = yield* transaction
        .select({ version: applications.version })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .for('update')
        .limit(1)

      const row = current.at(0)
      if (
        row === undefined ||
        (expectedVersion !== undefined && row.version !== expectedVersion)
      ) {
        return undefined
      }

      const revision = yield* allocateRevision(transaction)
      const updated = yield* transaction
        .update(applications)
        .set({
          ...changes,
          updatedAt: recordedAt,
          updatedRevision: revision,
          version: sql`${applications.version} + 1`,
        })
        .where(
          and(
            eq(applications.id, applicationId),
            eq(applications.version, row.version)
          )
        )
        .returning({ id: applications.id })

      return updated.length === 0
        ? undefined
        : yield* findApplication(
            transaction,
            eq(applications.id, applicationId)
          )
    })
  )
}

export const removeApplication = (
  database: RegistryExecutor,
  applicationId: string,
  expectedVersion?: number
) =>
  database
    .delete(applications)
    .where(
      and(
        eq(applications.id, applicationId),
        expectedVersion === undefined
          ? undefined
          : eq(applications.version, expectedVersion)
      )
    )
    .returning({ id: applications.id })
    .pipe(
      Effect.map((rows) => rows.length > 0),
      Effect.mapError(databaseFailure('Failed to remove application'))
    )
