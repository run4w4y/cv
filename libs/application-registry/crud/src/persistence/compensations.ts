import {
  applicationCompensations,
  fxRates,
  type NewFxRateRow,
} from '@cv/application-registry-entity'
import { and, desc, eq } from 'drizzle-orm'
import { Effect } from 'effect'

import type { RegistryQueryDatabase } from '../database'
import { databaseFailure } from '../errors'

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
