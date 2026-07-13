import {
  type Application,
  applicationCompensations,
  applicationEvents,
  applicationLabels,
  applicationNotes,
  applicationPublicColumns,
  applications,
  campaignCaptures,
} from '@cv/application-registry-entity'
import {
  and,
  asc,
  count,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  max,
  or,
  type SQL,
} from 'drizzle-orm'
import { Effect } from 'effect'
import { databaseFailure, type RegistryDatabaseError } from '../errors'
import type { RegistryQueryDatabase } from '../internal/connection'
import type {
  ApplicationFacets,
  ApplicationListFilter,
  ApplicationListRecord,
  CrudPage,
  FollowUpState,
} from '../types'

const cursorCondition = (afterRevision: number | undefined) =>
  afterRevision === undefined
    ? undefined
    : gt(applications.updatedRevision, afterRevision)

const followUpCondition = (
  states: readonly FollowUpState[] | undefined,
  now: string
) => {
  if (!states || states.length === 0 || new Set(states).size === 3) {
    return undefined
  }

  const conditions: SQL[] = []
  for (const state of new Set(states)) {
    if (state === 'none') conditions.push(isNull(applications.followUpAt))
    if (state === 'overdue') {
      conditions.push(lt(applications.followUpAt, now))
    }
    if (state === 'upcoming') {
      conditions.push(gte(applications.followUpAt, now))
    }
  }

  return or(...conditions)
}

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

const enrichApplications = (
  database: RegistryQueryDatabase,
  items: readonly Application[]
): Effect.Effect<readonly ApplicationListRecord[], RegistryDatabaseError> => {
  if (items.length === 0) return Effect.succeed([])

  const applicationIds = items.map(({ id }) => id)

  return Effect.gen(function* () {
    const labelRows = yield* database
      .select({
        applicationId: applicationLabels.applicationId,
        label: applicationLabels.label,
      })
      .from(applicationLabels)
      .where(inArray(applicationLabels.applicationId, applicationIds))
      .orderBy(
        asc(applicationLabels.applicationId),
        asc(applicationLabels.label)
      )

    const compensationRows = yield* database
      .select()
      .from(applicationCompensations)
      .where(inArray(applicationCompensations.applicationId, applicationIds))
      .orderBy(
        asc(applicationCompensations.applicationId),
        asc(applicationCompensations.kind),
        asc(applicationCompensations.id)
      )

    const latestEventRevisions = database
      .select({
        applicationId: applicationEvents.applicationId,
        revision: max(applicationEvents.revision).as('revision'),
      })
      .from(applicationEvents)
      .where(inArray(applicationEvents.applicationId, applicationIds))
      .groupBy(applicationEvents.applicationId)
      .as('latest_event_revisions')

    const latestEventRows = yield* database
      .select({
        applicationId: applicationEvents.applicationId,
        kind: applicationEvents.kind,
        occurredAt: applicationEvents.occurredAt,
      })
      .from(applicationEvents)
      .innerJoin(
        latestEventRevisions,
        and(
          eq(
            applicationEvents.applicationId,
            latestEventRevisions.applicationId
          ),
          eq(applicationEvents.revision, latestEventRevisions.revision)
        )
      )

    const captureCountRows = yield* database
      .select({
        applicationId: campaignCaptures.applicationId,
        value: count(),
      })
      .from(campaignCaptures)
      .where(inArray(campaignCaptures.applicationId, applicationIds))
      .groupBy(campaignCaptures.applicationId)

    const noteCountRows = yield* database
      .select({
        applicationId: applicationNotes.applicationId,
        value: count(),
      })
      .from(applicationNotes)
      .where(inArray(applicationNotes.applicationId, applicationIds))
      .groupBy(applicationNotes.applicationId)

    const labelsByApplication = new Map<string, string[]>()
    for (const row of labelRows) {
      const labels = labelsByApplication.get(row.applicationId) ?? []
      labels.push(row.label)
      labelsByApplication.set(row.applicationId, labels)
    }

    type CompensationRow = (typeof compensationRows)[number]
    const compensationsByApplication = new Map<string, CompensationRow[]>()
    for (const row of compensationRows) {
      const compensations =
        compensationsByApplication.get(row.applicationId) ?? []
      compensations.push(row)
      compensationsByApplication.set(row.applicationId, compensations)
    }

    const latestEventByApplication = new Map<
      string,
      (typeof latestEventRows)[number]
    >()
    for (const row of latestEventRows) {
      latestEventByApplication.set(row.applicationId, row)
    }

    const captureCountByApplication = new Map(
      captureCountRows.map((row) => [row.applicationId, row.value])
    )
    const noteCountByApplication = new Map(
      noteCountRows.map((row) => [row.applicationId, row.value])
    )

    return items.map((application) => {
      const latestEvent = latestEventByApplication.get(application.id)
      return {
        ...application,
        captureCount: captureCountByApplication.get(application.id) ?? 0,
        compensations: compensationsByApplication.get(application.id) ?? [],
        labels: labelsByApplication.get(application.id) ?? [],
        latestEventAt: latestEvent?.occurredAt ?? null,
        latestEventKind: latestEvent?.kind ?? null,
        noteCount: noteCountByApplication.get(application.id) ?? 0,
      }
    })
  }).pipe(
    Effect.mapError(
      databaseFailure('Failed to load application list dashboard details')
    )
  )
}

export const listApplications = (
  database: RegistryQueryDatabase,
  query: ApplicationListFilter
): Effect.Effect<CrudPage<ApplicationListRecord>, RegistryDatabaseError> =>
  Effect.gen(function* () {
    const limit = query.limit
    const company = query.company?.trim().toLocaleLowerCase('en-US')
    const location = query.location?.trim()
    const role = query.role?.trim()
    const baseQuery = database
      .select(applicationPublicColumns)
      .from(applications)
      .where(
        and(
          company
            ? like(applications.companyNormalized, `%${company}%`)
            : undefined,
          query.applicationStatus && query.applicationStatus.length > 0
            ? inArray(applications.applicationStatus, query.applicationStatus)
            : undefined,
          query.targetStage && query.targetStage.length > 0
            ? inArray(applications.targetStage, query.targetStage)
            : undefined,
          query.personalPriority && query.personalPriority.length > 0
            ? inArray(applications.personalPriority, query.personalPriority)
            : undefined,
          query.fitScoreMin === undefined
            ? undefined
            : gte(applications.fitScore, query.fitScoreMin),
          query.fitScoreMax === undefined
            ? undefined
            : lte(applications.fitScore, query.fitScoreMax),
          location ? like(applications.location, `%${location}%`) : undefined,
          role ? like(applications.role, `%${role}%`) : undefined,
          query.label && query.label.length > 0
            ? exists(
                database
                  .select({ applicationId: applicationLabels.applicationId })
                  .from(applicationLabels)
                  .where(
                    and(
                      eq(applicationLabels.applicationId, applications.id),
                      inArray(applicationLabels.label, query.label)
                    )
                  )
              )
            : undefined,
          followUpCondition(query.followUpState, query.now),
          query.url ? eq(applications.canonicalUrl, query.url) : undefined,
          cursorCondition(query.afterRevision)
        )
      )
      .orderBy(asc(applications.updatedRevision))

    const rows = yield* baseQuery
      .limit(limit + 1)
      .pipe(Effect.mapError(databaseFailure('Failed to list applications')))

    const hasNextPage = rows.length > limit
    const pageItems = hasNextPage ? rows.slice(0, limit) : rows
    const items = yield* enrichApplications(database, pageItems)
    return {
      hasNextPage,
      items,
    }
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
