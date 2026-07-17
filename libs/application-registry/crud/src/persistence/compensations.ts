import {
  applicationCompensations,
  applications,
  fxRates,
  type NewFxRateRow,
  registrySequence,
} from '@cv/application-registry-entity'
import { and, desc, eq, exists, inArray, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'
import { databaseFailure } from '../errors'
import type {
  RegistryConnections,
  RegistryQueryDatabase,
} from '../internal/connection'
import type { PersistedAnnualCompensation } from '../types'
import { currentRevision, runBatch } from './shared'

export const listCompensations = (
  database: RegistryQueryDatabase,
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

const allocateCompensationRevision = (
  database: RegistryConnections['batch'],
  applicationId: string,
  expectedVersion: number
) =>
  database
    .insert(registrySequence)
    .select(
      database
        .select({
          id: sql<number>`1`.as('id'),
          revision: sql<number>`1`.as('revision'),
        })
        .from(sql`(select 1)`)
        .where(
          exists(
            database
              .select({ id: applications.id })
              .from(applications)
              .where(
                and(
                  eq(applications.id, applicationId),
                  eq(applications.version, expectedVersion)
                )
              )
          )
        )
    )
    .onConflictDoUpdate({
      target: registrySequence.id,
      set: { revision: sql`${registrySequence.revision} + 1` },
    })

const applicationHasVersion = (
  database: RegistryConnections['batch'],
  applicationId: string,
  expectedVersion: number
) =>
  exists(
    database
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, expectedVersion)
        )
      )
  )

const annualCompensationInsert = (
  database: RegistryConnections['batch'],
  applicationId: string,
  expectedVersion: number,
  replacement: PersistedAnnualCompensation,
  recordedAt: string
) =>
  database.insert(applicationCompensations).select(
    database
      .select({
        applicationId: applications.id,
        createdAt: sql<string>`${recordedAt}`.as('created_at'),
        currencyCode: sql<string>`${replacement.currencyCode}`.as(
          'currency_code'
        ),
        id: sql<string>`${replacement.id}`.as('id'),
        kind: sql`${replacement.kind}`.as('kind'),
        maximumMinor: sql<number | null>`${replacement.maximumMinor}`.as(
          'maximum_minor'
        ),
        minimumMinor: sql<number | null>`${replacement.minimumMinor}`.as(
          'minimum_minor'
        ),
        period: sql<'year'>`'year'`.as('period'),
        rawText: sql<string | null>`${replacement.rawText}`.as('raw_text'),
        source: sql<string>`${replacement.source}`.as('source'),
        updatedAt: sql<string>`${recordedAt}`.as('updated_at'),
      })
      .from(applications)
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, expectedVersion)
        )
      )
  )

export const replaceAnnualCompensation = (
  database: RegistryConnections,
  applicationId: string,
  expectedVersion: number,
  replacement: PersistedAnnualCompensation | null,
  recordedAt: string
) => {
  const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
    allocateCompensationRevision(
      database.batch,
      applicationId,
      expectedVersion
    ),
  ]

  statements.push(
    database.batch
      .delete(applicationCompensations)
      .where(
        and(
          eq(applicationCompensations.applicationId, applicationId),
          eq(applicationCompensations.period, 'year'),
          inArray(applicationCompensations.kind, [
            'base_salary',
            'total_compensation',
          ]),
          applicationHasVersion(database.batch, applicationId, expectedVersion)
        )
      )
  )

  if (replacement !== null) {
    statements.push(
      annualCompensationInsert(
        database.batch,
        applicationId,
        expectedVersion,
        replacement,
        recordedAt
      )
    )
  }

  statements.push(
    database.batch
      .update(applications)
      .set({
        updatedAt: recordedAt,
        updatedRevision: currentRevision,
        version: sql`${applications.version} + 1`,
      })
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.version, expectedVersion)
        )
      )
  )

  return runBatch(
    database.batch,
    'annual compensation replacement',
    statements
  ).pipe(Effect.map((results) => (results.at(-1)?.meta.changes ?? 0) > 0))
}

export const findLatestFxRate = (
  database: RegistryQueryDatabase,
  baseCurrency: string,
  quoteCurrency: string
) =>
  database
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.baseCurrency, baseCurrency),
        eq(fxRates.quoteCurrency, quoteCurrency)
      )
    )
    .orderBy(desc(fxRates.fetchedAt), desc(fxRates.observedAt))
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to load exchange rate'))
    )

export const saveFxRate = (
  database: RegistryQueryDatabase,
  rate: NewFxRateRow
) =>
  database
    .insert(fxRates)
    .values(rate)
    .onConflictDoUpdate({
      target: [
        fxRates.baseCurrency,
        fxRates.quoteCurrency,
        fxRates.provider,
        fxRates.observedAt,
      ],
      set: { fetchedAt: rate.fetchedAt, rate: rate.rate },
    })
    .pipe(Effect.mapError(databaseFailure('Failed to cache exchange rate')))
