import {
  applicationActivities,
  applications,
} from '@cv/application-registry-entity'
import { finalizeQuery } from '@cv/drizzle-query-effect'
import { asc, count, eq, getColumns } from 'drizzle-orm'
import { Effect } from 'effect'
import { databaseFailure, type RegistryDatabaseError } from '../errors'
import type { RegistryExecutor } from '../internal/connection'
import type { ActivityListPage, ActivityListResolution } from '../types'

export const listApplicationActivities = (
  database: RegistryExecutor,
  applicationId: string
) =>
  database
    .select()
    .from(applicationActivities)
    .where(eq(applicationActivities.applicationId, applicationId))
    .orderBy(
      asc(applicationActivities.occurredAt),
      asc(applicationActivities.id)
    )
    .pipe(
      Effect.mapError(databaseFailure('Failed to list application activities'))
    )

export const listActivities = (
  database: RegistryExecutor,
  resolved: ActivityListResolution
): Effect.Effect<ActivityListPage, RegistryDatabaseError> =>
  Effect.gen(function* () {
    const query = resolved.apply(
      database
        .select({
          ...getColumns(applicationActivities),
          postingUrl: applications.postingUrl,
          company: applications.company,
          role: applications.role,
          ...resolved.requiredSelection,
        })
        .from(applicationActivities)
        .innerJoin(
          applications,
          eq(applicationActivities.applicationId, applications.id)
        )
        .$dynamic()
    )

    const firstPage = resolved.pagination.seekWhere === undefined
    const { rows, totalItems } = yield* Effect.all(
      {
        rows: query.pipe(
          Effect.mapError(databaseFailure('Failed to list registry activities'))
        ),
        totalItems: firstPage
          ? database
              .select({ value: count() })
              .from(applicationActivities)
              .where(resolved.filtering.where)
              .pipe(
                Effect.map((result) => result.at(0)?.value),
                Effect.mapError(
                  databaseFailure('Failed to count registry activities')
                )
              )
          : Effect.succeed(undefined),
      },
      { concurrency: 'unbounded' }
    )

    return yield* finalizeQuery(resolved, rows, totalItems).pipe(Effect.orDie)
  })
