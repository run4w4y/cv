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
  applicationActivityKindValues,
  applicationStatusValues,
  listingAvailabilityValues,
  listingCheckConfidenceValues,
  listingCheckReasonValues,
  personalPriorityValues,
  targetStageValues,
} from '../model/values'
import { applicationLabels, applicationNotes } from '../tables/annotations'
import { applications } from '../tables/applications'
import { applicationActivities } from '../tables/activities'
import { timestampFilterOperators } from './timestamp-filter-operators'

const escapeLikeLiteral = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')

const likeEscapeCharacter = sql`${'\\'}`.inlineParams()

const literalContains = (expression: SQLWrapper, value: string): SQL =>
  sql`${expression} like ${sql.param(`%${escapeLikeLiteral(value)}%`)} escape ${likeEscapeCharacter}`

/** Authoritative filtering, ordering, and cursor contract for application lists. */
export const applicationListQuery = defineQuery(
  applications,
  ({ col, expr, rel }, root) => {
    const matchesQuery = schemaBinaryFilterOperator('matches', Schema.String, {
      valueDescriptor: { type: 'string' },
      compile: ({ value }) =>
        sql`(
            ${literalContains(root.postingUrl, value)} or
            ${literalContains(root.company, value)} or
            ${literalContains(root.role, value)} or
            ${literalContains(root.location, value)}
          )`,
    })
    const companyContains = schemaBinaryFilterOperator(
      'contains',
      Schema.String,
      {
        valueDescriptor: { type: 'string' },
        compile: ({ value }) =>
          literalContains(sql`lower(${root.company})`, value.toLowerCase()),
      }
    )
    const latestActivityAt = sql<string>`(
      select ${applicationActivities.occurredAt}
      from ${applicationActivities}
      where ${applicationActivities.applicationId} = ${root.id}
      order by ${applicationActivities.revision} desc
      limit 1
    )`
    const latestActivityKind = sql<
      (typeof applicationActivityKindValues)[number]
    >`(
      select ${applicationActivities.kind}
      from ${applicationActivities}
      where ${applicationActivities.applicationId} = ${root.id}
      order by ${applicationActivities.revision} desc
      limit 1
    )`
    return [
      col.id.filterable().sortable(),
      ...col({
        exclude: [
          'id',
          'appliedAt',
          'company',
          'createdAt',
          'followUpAt',
          'postingFingerprint',
          'postingUrlNormalized',
          'applicationStatus',
          'targetStage',
          'personalPriority',
          'listingAvailability',
          'listingConfidence',
          'listingReasonCode',
          'listingCheckedAt',
          'listingClosedCandidateAt',
          'updatedAt',
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
      col.appliedAt
        .filterable((defaults) =>
          appendOperators(defaults, timestampFilterOperators)
        )
        .sortable(),
      col.listingCheckedAt
        .filterable((defaults) =>
          appendOperators(defaults, timestampFilterOperators)
        )
        .sortable(),
      col.listingClosedCandidateAt
        .filterable((defaults) =>
          appendOperators(defaults, timestampFilterOperators)
        )
        .sortable(),
      col.createdAt
        .filterable((defaults) =>
          appendOperators(defaults, timestampFilterOperators)
        )
        .sortable(),
      col.updatedAt
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
        .string(latestActivityAt, { nullable: true })
        .as('latestActivityAt')
        .filterable((defaults) =>
          appendOperators(defaults, timestampFilterOperators)
        )
        .sortable(),
      expr
        .enum(latestActivityKind, applicationActivityKindValues, {
          nullable: true,
        })
        .as('latestActivityKind')
        .filterable()
        .sortable({ values: applicationActivityKindValues }),
      expr.filter('q', [matchesQuery]),
    ]
  },
  {
    cursor: { revision: 'applications-list-v9' },
    defaultOrderBy: [{ field: 'updatedRevision', direction: 'asc' }],
    pagination: cursorPagination({ defaultSize: 50, maxSize: 100 }),
  }
)

/** Typed request inferred from {@link applicationListQuery}. */
export type ApplicationListQueryRequest = QueryRequestOf<
  typeof applicationListQuery
>
