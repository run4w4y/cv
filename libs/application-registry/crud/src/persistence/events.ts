import {
  type ApplicationEvent,
  applicationEvents,
  campaignCaptures,
} from '@cv/application-registry-entity'
import { asc, eq, gt } from 'drizzle-orm'
import { Effect } from 'effect'

import type { RegistryQueryDatabase } from '../database'
import { databaseFailure, type RegistryDatabaseError } from '../errors'
import type { CrudPage, EventListFilter } from '../types'

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
): Effect.Effect<CrudPage<ApplicationEvent>, RegistryDatabaseError> =>
  Effect.gen(function* () {
    const limit = query.limit
    const rows = yield* database
      .select()
      .from(applicationEvents)
      .where(
        query.afterRevision === undefined
          ? undefined
          : gt(applicationEvents.revision, query.afterRevision)
      )
      .orderBy(asc(applicationEvents.revision))
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
