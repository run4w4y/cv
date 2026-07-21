import {
  applicationCompensations,
  applications,
} from '@cv/application-registry-entity'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure } from '../errors'
import type { RegistryDatabase, RegistryExecutor } from '../internal/connection'
import type { PersistedAnnualCompensation } from '../types'
import { allocateRevision, runTransaction } from './shared'

export const listCompensations = (
  database: RegistryExecutor,
  applicationId: string
) =>
  database
    .select()
    .from(applicationCompensations)
    .where(eq(applicationCompensations.applicationId, applicationId))
    .orderBy(applicationCompensations.kind, applicationCompensations.id)
    .pipe(
      Effect.mapError(
        databaseFailure('Failed to list application compensation')
      )
    )

export const replaceAnnualCompensation = (
  database: RegistryDatabase,
  applicationId: string,
  expectedVersion: number,
  replacement: PersistedAnnualCompensation | null,
  recordedAt: string
) =>
  runTransaction(database, 'annual compensation replacement', (transaction) =>
    Effect.gen(function* () {
      const current = yield* transaction
        .select({ version: applications.version })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .for('update')
        .limit(1)

      const row = current.at(0)
      if (row === undefined || row.version !== expectedVersion) {
        return false
      }

      const revision = yield* allocateRevision(transaction)
      yield* transaction
        .delete(applicationCompensations)
        .where(
          and(
            eq(applicationCompensations.applicationId, applicationId),
            eq(applicationCompensations.period, 'year'),
            inArray(applicationCompensations.kind, [
              'base_salary',
              'total_compensation',
            ])
          )
        )

      if (replacement !== null) {
        yield* transaction.insert(applicationCompensations).values({
          ...replacement,
          applicationId,
          createdAt: recordedAt,
          period: 'year',
          updatedAt: recordedAt,
        })
      }

      const updated = yield* transaction
        .update(applications)
        .set({
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

      return updated.length > 0
    })
  )
