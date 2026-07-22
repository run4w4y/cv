import {
  appendOperators,
  cursorPagination,
  defineQuery,
  type QueryRequestOf,
} from '@cv/drizzle-query'
import {
  applicationActivityActorValues,
  applicationActivityKindValues,
  applicationActivitySourceValues,
} from '../model/values'
import { applicationActivities } from '../tables/activities'
import { timestampFilterOperators } from './timestamp-filter-operators'

/** Authoritative filtering and ordering contract for the read-only activity feed. */
export const activityListQuery = defineQuery(
  applicationActivities,
  ({ col }) => [
    col.id.filterable().sortable(),
    col.applicationId.filterable().sortable(),
    col.kind.filterable().sortable({ values: applicationActivityKindValues }),
    col.actor.filterable().sortable({ values: applicationActivityActorValues }),
    col.source
      .filterable()
      .sortable({ values: applicationActivitySourceValues }),
    col.revision.filterable().sortable({ unique: true }),
    col.occurredAt
      .filterable((defaults) =>
        appendOperators(defaults, timestampFilterOperators)
      )
      .sortable(),
  ],
  {
    cursor: { revision: 'registry-activities-list-v1' },
    defaultOrderBy: [{ field: 'revision', direction: 'asc' }],
    pagination: cursorPagination({ defaultSize: 50, maxSize: 100 }),
  }
)

export type ActivityListQueryRequest = QueryRequestOf<typeof activityListQuery>
