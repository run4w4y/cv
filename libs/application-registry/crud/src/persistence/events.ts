import {
  applicationEvents,
  applications,
  campaignCaptures,
} from '@cv/application-registry-entity'
import { and, asc, eq, getColumns, gt, gte, inArray, lte } from 'drizzle-orm'
import { Effect } from 'effect'
import { databaseFailure, type RegistryDatabaseError } from '../errors'
import type { RegistryQueryDatabase } from '../internal/connection'
import type { CrudPage, EventListFilter, RegistryEventListItem } from '../types'

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
  query: EventListFilter
): Effect.Effect<CrudPage<RegistryEventListItem>, RegistryDatabaseError> =>
  Effect.gen(function* () {
    const limit = query.limit
    const baseQuery = database
      .select({
        ...getColumns(applicationEvents),
        canonicalUrl: applications.canonicalUrl,
        company: applications.company,
        role: applications.role,
      })
      .from(applicationEvents)
      .innerJoin(
        applications,
        eq(applicationEvents.applicationId, applications.id)
      )
      .where(
        and(
          query.afterRevision === undefined
            ? undefined
            : gt(applicationEvents.revision, query.afterRevision),
          query.from
            ? gte(applicationEvents.occurredAt, query.from)
            : undefined,
          query.to ? lte(applicationEvents.occurredAt, query.to) : undefined,
          query.kind && query.kind.length > 0
            ? inArray(applicationEvents.kind, query.kind)
            : undefined
        )
      )
      .orderBy(asc(applicationEvents.revision))

    const rows = yield* baseQuery
      .limit(limit + 1)
      .pipe(Effect.mapError(databaseFailure('Failed to list registry events')))

    const hasNextPage = rows.length > limit
    const items = hasNextPage ? rows.slice(0, limit) : rows
    return {
      hasNextPage,
      items,
    }
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
