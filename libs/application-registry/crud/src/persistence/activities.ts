import {
  applicationActivities,
  applications,
} from '@cv/application-registry-entity'
import { finalizeQuery } from '@cv/drizzle-query-effect'
import { asc, eq, getColumns } from 'drizzle-orm'
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

    const rows = yield* query.pipe(
      Effect.mapError(databaseFailure('Failed to list registry activities'))
    )

    return yield* finalizeQuery(resolved, rows).pipe(Effect.orDie)
  })
