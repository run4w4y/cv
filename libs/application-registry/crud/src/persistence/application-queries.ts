import {
  applicationLabels,
  applicationPublicColumns,
  applications,
} from '@cv/application-registry-entity'
import { finalizeQuery } from '@cv/drizzle-query-effect'
import { asc, desc, eq, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  databaseFailure,
  type RegistryDatabaseError,
  type RegistryQueryTooComplexError,
} from '../errors'
import type { RegistryQueryDatabase } from '../internal/connection'
import type {
  ApplicationFacets,
  ApplicationListPage,
  ApplicationListRecord,
  ApplicationListResolution,
} from '../types'
import { enforceD1ParameterBudget } from './query-budget'

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
) => findApplication(database, eq(applications.id, identifier))

export const findApplicationByPostingFingerprint = (
  database: RegistryQueryDatabase,
  fingerprint: string
) => findApplication(database, eq(applications.postingFingerprint, fingerprint))

export const findApplicationsByPostingUrl = (
  database: RegistryQueryDatabase,
  postingUrlNormalized: string
) =>
  database
    .select(applicationPublicColumns)
    .from(applications)
    .where(eq(applications.postingUrlNormalized, postingUrlNormalized))
    .orderBy(asc(applications.createdAt), asc(applications.id))
    .pipe(
      Effect.mapError(
        databaseFailure('Failed to load applications by posting URL')
      )
    )

export const listApplications = (
  database: RegistryQueryDatabase,
  resolved: ApplicationListResolution
): Effect.Effect<
  ApplicationListPage,
  RegistryDatabaseError | RegistryQueryTooComplexError
> =>
  Effect.gen(function* () {
    const relational = resolved.relational({ select: ['noteCount'] })
    const query = database.query.applications.findMany({
      ...relational.config,
      columns: { postingFingerprint: false, postingUrlNormalized: false },
      with: {
        compensations: {
          orderBy: (compensation) => [
            asc(compensation.kind),
            asc(compensation.id),
          ],
        },
        activities: {
          columns: { kind: true, occurredAt: true },
          limit: 1,
          orderBy: (activity) => desc(activity.revision),
        },
        labels: {
          columns: { label: true },
          orderBy: (label) => asc(label.label),
        },
      },
    })

    yield* enforceD1ParameterBudget(query, 'Application list query')
    const rows = yield* query.pipe(
      Effect.mapError(databaseFailure('Failed to list applications'))
    )

    const page = yield* finalizeQuery(relational, rows).pipe(Effect.orDie)
    const records = page.items.map((row) => {
      const { compensations, activities, labels, noteCount, ...application } =
        row
      const latestActivity = activities.at(0) ?? null
      return {
        ...application,
        compensations,
        counts: { notes: noteCount },
        labels: labels.map(({ label }) => label),
        latestActivity,
      } satisfies ApplicationListRecord
    })

    return { items: records, pageInfo: page.pageInfo }
  })

export const listApplicationFacets = (
  database: RegistryQueryDatabase
): Effect.Effect<ApplicationFacets, RegistryDatabaseError> =>
  Effect.gen(function* () {
    const companies = yield* database
      .selectDistinct({ value: applications.company })
      .from(applications)
      .orderBy(asc(applications.company))

    const labels = yield* database
      .selectDistinct({ value: applicationLabels.label })
      .from(applicationLabels)
      .orderBy(asc(applicationLabels.label))

    return {
      companies: companies.map(({ value }) => value),
      labels: labels.map(({ value }) => value),
    }
  }).pipe(Effect.mapError(databaseFailure('Failed to list application facets')))
