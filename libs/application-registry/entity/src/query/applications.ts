import {
  appendOperators,
  cursorPagination,
  defineQuery,
  type QueryRequestOf,
  replaceOperator,
} from '@cv/drizzle-query'
import { schemaBinaryFilterOperator } from '@cv/drizzle-query-effect/schema'
import { eq, type SQL, type SQLWrapper, sql } from 'drizzle-orm'
import { Schema } from 'effect'

import {
  applicationEventKindValues,
  applicationStatusValues,
  listingAvailabilityValues,
  listingCheckConfidenceValues,
  listingCheckReasonValues,
  personalPriorityValues,
  targetStageValues,
} from '../model/values'
import { applicationLabels, applicationNotes } from '../tables/annotations'
import { applications } from '../tables/applications'
import { campaignCaptures } from '../tables/captures'
import { applicationEvents } from '../tables/events'
import { applicationIdentityAliases } from '../tables/identity-aliases'
import { timestampFilterOperators } from './timestamp-filter-operators'

const escapeLikeLiteral = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')

const literalContains = (expression: SQLWrapper, value: string): SQL =>
  sql`${expression} like ${sql.param(`%${escapeLikeLiteral(value)}%`)} escape ${sql.param('\\')}`

/** Authoritative filtering, ordering, and cursor contract for application lists. */
export const applicationListQuery = defineQuery(
  applications,
  ({ col, expr, rel }, root) => {
    const matchesQuery = schemaBinaryFilterOperator('matches', Schema.String, {
      compile: ({ value }) =>
        sql`(
            ${literalContains(root.jobKey, value)} or
            ${literalContains(root.source, value)} or
            ${literalContains(root.sourceJobId, value)} or
            ${literalContains(root.canonicalUrl, value)} or
            ${literalContains(root.company, value)} or
            ${literalContains(root.role, value)} or
            ${literalContains(root.location, value)}
          )`,
    })
    const companyContains = schemaBinaryFilterOperator(
      'contains',
      Schema.String,
      {
        compile: ({ value }) =>
          literalContains(
            root.companyNormalized,
            value.toLocaleLowerCase('en-US')
          ),
      }
    )
    const latestEventAt = sql<string>`(
      select ${applicationEvents.occurredAt}
      from ${applicationEvents}
      where ${applicationEvents.applicationId} = ${root.id}
      order by ${applicationEvents.revision} desc
      limit 1
    )`
    const latestEventKind = sql<(typeof applicationEventKindValues)[number]>`(
      select ${applicationEvents.kind}
      from ${applicationEvents}
      where ${applicationEvents.applicationId} = ${root.id}
      order by ${applicationEvents.revision} desc
      limit 1
    )`
    const latestApplicationUrl = sql<string>`(
      select ${campaignCaptures.applicationUrl}
      from ${campaignCaptures}
      where ${campaignCaptures.applicationId} = ${root.id}
      order by ${campaignCaptures.capturedAt} desc, ${campaignCaptures.id} desc
      limit 1
    )`

    return [
      col.id.filterable().sortable(),
      ...col({
        exclude: [
          'id',
          'company',
          'companyNormalized',
          'followUpAt',
          'applicationStatus',
          'targetStage',
          'personalPriority',
          'listingAvailability',
          'listingConfidence',
          'listingReasonCode',
          'updatedRevision',
        ],
      }),
      col.company
        .filterable((defaults) => replaceOperator(defaults, companyContains))
        .sortable(),
      col.followUpAt
        .filterable((defaults) =>
          appendOperators(defaults, timestampFilterOperators)
        )
        .sortable(),
      col.applicationStatus
        .filterable()
        .sortable({ values: applicationStatusValues }),
      col.targetStage.filterable().sortable({ values: targetStageValues }),
      col.personalPriority
        .filterable()
        .sortable({ values: personalPriorityValues }),
      col.listingAvailability
        .filterable()
        .sortable({ values: listingAvailabilityValues }),
      col.listingConfidence
        .filterable()
        .sortable({ values: listingCheckConfidenceValues }),
      col.listingReasonCode
        .filterable()
        .sortable({ values: listingCheckReasonValues }),
      col.updatedRevision.filterable().sortable({ unique: true }),
      rel
        .many(applicationLabels, {
          on: ({ root: columns, related }) =>
            eq(related.applicationId, columns.id),
          value: ({ related }) => related.label,
        })
        .as('labels')
        .filterable(),
      rel
        .many(applicationIdentityAliases, {
          on: ({ root: columns, related }) =>
            eq(related.applicationId, columns.id),
          value: ({ related }) => related.jobKey,
        })
        .as('identityAliases')
        .filterable(),
      rel
        .many(campaignCaptures, {
          on: ({ root: columns, related }) =>
            eq(related.applicationId, columns.id),
          value: ({ related }) => related.id,
        })
        .count()
        .as('captureCount')
        .filterable()
        .sortable(),
      rel
        .many(applicationNotes, {
          on: ({ root: columns, related }) =>
            eq(related.applicationId, columns.id),
          value: ({ related }) => related.id,
        })
        .count()
        .as('noteCount')
        .filterable()
        .sortable(),
      expr
        .string(latestEventAt, { nullable: true })
        .as('latestEventAt')
        .filterable()
        .sortable(),
      expr
        .enum(latestEventKind, applicationEventKindValues, { nullable: true })
        .as('latestEventKind')
        .filterable()
        .sortable({ values: applicationEventKindValues }),
      expr
        .string(latestApplicationUrl, { nullable: true })
        .as('latestApplicationUrl')
        .filterable(),
      expr.filter('q', [matchesQuery]),
    ]
  },
  {
    cursor: { revision: 'applications-list-v5' },
    defaultOrderBy: [{ field: 'updatedRevision', direction: 'asc' }],
    pagination: cursorPagination({ defaultSize: 50, maxSize: 100 }),
  }
)

/** Typed request inferred from {@link applicationListQuery}. */
export type ApplicationListQueryRequest = QueryRequestOf<
  typeof applicationListQuery
>
