import { applications } from '@cv/application-registry-entity'
import { and, eq, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { databaseFailure, RegistryDatabaseError } from '../errors'
import type {
  RegistryConnections,
  RegistryQueryDatabase,
} from '../internal/connection'
import type { ApplicationPatch, PersistApplicationOptions } from '../types'
import { findApplication } from './application-queries'
import {
  opportunityStatements,
  type PersistedOpportunity,
} from './application-values'
import { allocateRevision, currentRevision, runBatch } from './shared'

export const persistApplication = (
  { batch }: RegistryConnections,
  input: PersistedOpportunity,
  options: PersistApplicationOptions
) =>
  runBatch(batch, options.operation, [
    allocateRevision(batch),
    ...opportunityStatements(batch, input, options.mode),
  ]).pipe(
    Effect.flatMap((results) =>
      (results[1]?.meta.changes ?? 0) > 0
        ? Effect.void
        : Effect.fail(
            new RegistryDatabaseError({
              cause: new Error(
                `Job key ${input.jobKey} was claimed by another application.`
              ),
              message: `Failed to execute ${options.operation}`,
            })
          )
    )
  )

export const patchApplication = (
  database: RegistryConnections,
  applicationId: string,
  request: ApplicationPatch,
  recordedAt: string
) => {
  const { expectedVersion, ...changes } = request

  return runBatch(database.batch, 'application update', [
    allocateRevision(database.batch),
    database.batch
      .update(applications)
      .set({
        ...changes,
        updatedAt: recordedAt,
        updatedRevision: currentRevision,
        version: sql`${applications.version} + 1`,
      })
      .where(
        and(
          eq(applications.id, applicationId),
          expectedVersion === undefined
            ? undefined
            : eq(applications.version, expectedVersion)
        )
      ),
  ]).pipe(
    Effect.map((results) => results.at(-1)?.meta.changes ?? 0),
    Effect.flatMap((changes) =>
      changes === 0
        ? Effect.succeed(undefined)
        : findApplication(database.query, eq(applications.id, applicationId))
    )
  )
}

export const removeApplication = (
  database: RegistryQueryDatabase,
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
