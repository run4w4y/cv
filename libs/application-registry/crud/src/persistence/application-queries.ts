import {
  type Application,
  applicationLabels,
  applicationPublicColumns,
  applications,
} from '@cv/application-registry-entity'
import { and, asc, eq, exists, gt, like, or, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'

import type { RegistryQueryDatabase } from '../database'
import { databaseFailure, type RegistryDatabaseError } from '../errors'
import type { ApplicationListFilter, CrudPage } from '../types'

const cursorCondition = (afterRevision: number | undefined) =>
  afterRevision === undefined
    ? undefined
    : gt(applications.updatedRevision, afterRevision)

export const findApplication = (
  database: RegistryQueryDatabase,
  condition: SQL | undefined
) =>
  database
    .select(applicationPublicColumns)
    .from(applications)
    .where(condition)
    .limit(1)
    .pipe(
      Effect.map((rows) => rows.at(0)),
      Effect.mapError(databaseFailure('Failed to load application'))
    )

export const findApplicationByIdentifier = (
  database: RegistryQueryDatabase,
  identifier: string
) =>
  findApplication(
    database,
    or(eq(applications.id, identifier), eq(applications.jobKey, identifier))
  )

export const findApplicationByJobKey = (
  database: RegistryQueryDatabase,
  jobKey: string
) => findApplication(database, eq(applications.jobKey, jobKey))

export const listApplications = (
  database: RegistryQueryDatabase,
  query: ApplicationListFilter
): Effect.Effect<CrudPage<Application>, RegistryDatabaseError> =>
  Effect.gen(function* () {
    const limit = query.limit
    const company = query.company?.trim().toLocaleLowerCase('en-US')
    const rows = yield* database
      .select(applicationPublicColumns)
      .from(applications)
      .where(
        and(
          company
            ? like(applications.companyNormalized, `%${company}%`)
            : undefined,
          query.applicationStatus
            ? eq(applications.applicationStatus, query.applicationStatus)
            : undefined,
          query.targetStage
            ? eq(applications.targetStage, query.targetStage)
            : undefined,
          query.label
            ? exists(
                database
                  .select({ applicationId: applicationLabels.applicationId })
                  .from(applicationLabels)
                  .where(
                    and(
                      eq(applicationLabels.applicationId, applications.id),
                      eq(applicationLabels.label, query.label)
                    )
                  )
              )
            : undefined,
          query.url ? eq(applications.canonicalUrl, query.url) : undefined,
          cursorCondition(query.afterRevision)
        )
      )
      .orderBy(asc(applications.updatedRevision))
      .limit(limit + 1)
      .pipe(Effect.mapError(databaseFailure('Failed to list applications')))

    const hasNextPage = rows.length > limit
    const items = hasNextPage ? rows.slice(0, limit) : rows
    return {
      hasNextPage,
      items,
    }
  })
