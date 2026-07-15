import {
  applicationIdentityAliases,
  applicationLabels,
  applicationPublicColumns,
  applications,
} from '@cv/application-registry-entity'
import { finalizeQuery } from '@cv/drizzle-query-effect'
import {
  and,
  asc,
  desc,
  eq,
  exists,
  isNotNull,
  or,
  type SQL,
} from 'drizzle-orm'
import { Effect } from 'effect'
import { databaseFailure, type RegistryDatabaseError } from '../errors'
import type { RegistryQueryDatabase } from '../internal/connection'
import type {
  ApplicationFacets,
  ApplicationListPage,
  ApplicationListRecord,
  ApplicationListResolution,
} from '../types'

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
) =>
  findApplication(
    database,
    or(
      eq(applications.jobKey, jobKey),
      exists(
        database
          .select({ applicationId: applicationIdentityAliases.applicationId })
          .from(applicationIdentityAliases)
          .where(
            and(
              eq(applicationIdentityAliases.applicationId, applications.id),
              eq(applicationIdentityAliases.jobKey, jobKey)
            )
          )
      )
    )
  )

export const findApplicationsByCanonicalUrl = (
  database: RegistryQueryDatabase,
  canonicalUrl: string
) =>
  database
    .select(applicationPublicColumns)
    .from(applications)
    .where(eq(applications.canonicalUrl, canonicalUrl))
    .orderBy(asc(applications.createdAt), asc(applications.id))
    .pipe(
      Effect.mapError(
        databaseFailure('Failed to load applications by canonical URL')
      )
    )

export const listApplications = (
  database: RegistryQueryDatabase,
  resolved: ApplicationListResolution
): Effect.Effect<ApplicationListPage, RegistryDatabaseError> =>
  Effect.gen(function* () {
    const relational = resolved.relational({
      select: ['captureCount', 'noteCount'],
    })
    const rows = yield* database.query.applications
      .findMany({
        ...relational.config,
        columns: { companyNormalized: false },
        with: {
          captures: {
            columns: { applicationUrl: true },
            limit: 1,
            orderBy: (capture) => [desc(capture.capturedAt), desc(capture.id)],
          },
          compensations: {
            orderBy: (compensation) => [
              asc(compensation.kind),
              asc(compensation.id),
            ],
          },
          events: {
            columns: { kind: true, occurredAt: true },
            limit: 1,
            orderBy: (event) => desc(event.revision),
          },
          identityAliases: {
            columns: { jobKey: true },
            orderBy: (identityAlias) => asc(identityAlias.jobKey),
          },
          labels: {
            columns: { label: true },
            orderBy: (label) => asc(label.label),
          },
        },
      })
      .pipe(Effect.mapError(databaseFailure('Failed to list applications')))

    const page = yield* finalizeQuery(relational, rows).pipe(Effect.orDie)
    const records = page.items.map((row) => {
      const {
        captureCount,
        captures,
        compensations,
        events,
        identityAliases,
        labels,
        noteCount,
        ...application
      } = row
      const latestEvent = events.at(0) ?? null
      return {
        ...application,
        compensations,
        counts: { captures: captureCount, notes: noteCount },
        identityAliases: identityAliases.map(({ jobKey }) => jobKey),
        labels: labels.map(({ label }) => label),
        latestCapture: captures.at(0) ?? null,
        latestEvent,
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

    const applicationStatuses = yield* database
      .selectDistinct({ value: applications.applicationStatus })
      .from(applications)
      .orderBy(asc(applications.applicationStatus))

    const targetStages = yield* database
      .selectDistinct({ value: applications.targetStage })
      .from(applications)
      .orderBy(asc(applications.targetStage))

    const personalPriorities = yield* database
      .selectDistinct({ value: applications.personalPriority })
      .from(applications)
      .where(isNotNull(applications.personalPriority))
      .orderBy(asc(applications.personalPriority))

    const labels = yield* database
      .selectDistinct({ value: applicationLabels.label })
      .from(applicationLabels)
      .orderBy(asc(applicationLabels.label))

    return {
      applicationStatuses: applicationStatuses.map(({ value }) => value),
      companies: companies.map(({ value }) => value),
      labels: labels.map(({ value }) => value),
      personalPriorities: personalPriorities.flatMap(({ value }) =>
        value === null ? [] : [value]
      ),
      targetStages: targetStages.map(({ value }) => value),
    }
  }).pipe(Effect.mapError(databaseFailure('Failed to list application facets')))
