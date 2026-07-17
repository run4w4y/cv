import {
  applicationEvents,
  applications,
  campaignCaptures,
} from '@cv/application-registry-entity'
import { finalizeQuery } from '@cv/drizzle-query-effect'
import { asc, eq, getColumns } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  databaseFailure,
  type RegistryDatabaseError,
  type RegistryQueryTooComplexError,
} from '../errors'
import type { RegistryQueryDatabase } from '../internal/connection'
import type { EventListPage, EventListResolution } from '../types'
import { enforceD1ParameterBudget } from './query-budget'

export const findEventByOperation = (
  database: RegistryQueryDatabase,
  operationId: string
) =>
  database
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.operationId, operationId))
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to load application event'))
    )

export const listApplicationEvents = (
  database: RegistryQueryDatabase,
  applicationId: string
) =>
  database
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId))
    .orderBy(asc(applicationEvents.occurredAt), asc(applicationEvents.id))
    .pipe(Effect.mapError(databaseFailure('Failed to list application events')))

export const listEvents = (
  database: RegistryQueryDatabase,
  resolved: EventListResolution
): Effect.Effect<
  EventListPage,
  RegistryDatabaseError | RegistryQueryTooComplexError
> =>
  Effect.gen(function* () {
    const query = resolved.apply(
      database
        .select({
          ...getColumns(applicationEvents),
          canonicalUrl: applications.canonicalUrl,
          company: applications.company,
          role: applications.role,
          ...resolved.requiredSelection,
        })
        .from(applicationEvents)
        .innerJoin(
          applications,
          eq(applicationEvents.applicationId, applications.id)
        )
        .$dynamic()
    )

    yield* enforceD1ParameterBudget(query, 'Registry event list query')
    const rows = yield* query.pipe(
      Effect.mapError(databaseFailure('Failed to list registry events'))
    )

    return yield* finalizeQuery(resolved, rows).pipe(Effect.orDie)
  })

export const findCaptureByOperation = (
  database: RegistryQueryDatabase,
  operationId: string
) =>
  database
    .select()
    .from(campaignCaptures)
    .where(eq(campaignCaptures.operationId, operationId))
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to load campaign capture'))
    )

export const listApplicationCaptures = (
  database: RegistryQueryDatabase,
  applicationId: string
) =>
  database
    .select()
    .from(campaignCaptures)
    .where(eq(campaignCaptures.applicationId, applicationId))
    .orderBy(asc(campaignCaptures.capturedAt), asc(campaignCaptures.id))
    .pipe(Effect.mapError(databaseFailure('Failed to list campaign captures')))
